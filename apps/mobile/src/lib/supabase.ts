import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database as GeneratedDatabase } from 'shared/src/types/supabase';

// API DRIFT MIGRATION (in progress)
// ---------------------------------
// The hand-written interfaces in `apps/mobile/src/api/*.ts` predate the
// generated `Database` type from `shared/src/types/supabase.ts`. Flipping the
// default `supabase` client to the generated type in one shot would surface
// dozens of nullability + column-name mismatches across ~50 call sites — too
// much churn for a single PR.
//
// Migration strategy (incremental, opt-in):
//   - `supabase` (default export) stays untyped (`any`). Existing API files
//     that still ship hand-written interfaces use this to avoid drift errors.
//   - `supabaseTyped` is the SAME runtime client, re-exported as the
//     generated `Database` type. New API code should import this and derive
//     row/insert/update types via `Database['public']['Tables'][X]['Row']`.
//   - Per-file migrations: replace the file's `import { supabase }` with
//     `import { supabaseTyped as supabase }`, then refactor the file's
//     hand-written interfaces to derive from the generated row types. Each
//     file can be migrated independently; `tsc` will report mismatches
//     scoped to just that file.
//
// Regenerate types after schema changes:
//   `pnpm --filter shared supabase:types`  (or `npx supabase gen types …`)
type Database = any;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Auth storage adapter — SecureStore (iOS Keychain) always; AsyncStorage only as
// a DEV fallback. The case it exists for:
//   iOS Simulator dev builds. When xcodebuild runs with CODE_SIGNING_ALLOWED=NO
//   (no Apple Dev cert on the machine) the app's `application-identifier`
//   entitlement isn't set, so every Keychain call throws "A required entitlement
//   isn't present." Sim dev only — Release builds going through TestFlight /
//   App Store are signed properly and use Keychain.
//
// SECURITY (audit 2026-09-04): the fallback is DEV-ONLY.
//
// It used to apply in every build. On the FIRST Keychain error it latched
// `secureStoreUnavailable = true` for the whole process and wrote the Supabase
// session — including the long-lived REFRESH TOKEN — to AsyncStorage, which is
// plain, unencrypted app-sandbox storage. There was no path back: once written it
// stayed in clear text even after Keychain recovered.
//
// The stated reason (unsigned simulator builds have no `application-identifier`
// entitlement, so every Keychain call throws) is real, but it is a DEV problem.
// In a Release build a Keychain failure is a transient glitch — a locked Keychain
// during a background refresh, a restored backup mid-launch — and the right
// response is to lose the session, not to downgrade a credential that unlocks
// every one of this mother's health records to plaintext on a device that may be
// jailbroken, imaged, or backed up unencrypted.
//
// Production behaviour is therefore fail-closed but non-fatal:
//   getItem    → null   (no session found ⇒ she signs in again)
//   setItem    → no-op  (session simply isn't persisted this launch)
//   removeItem → no-op  (and the AsyncStorage purge below still runs)
// Nothing throws, so the auth bootstrap can't crash on a Keychain hiccup.
const ALLOW_INSECURE_FALLBACK = __DEV__;

let secureStoreUnavailable = false;
let warnedOnce = false;

// Any AsyncStorage copy is a leftover from a previous build or a dev session.
// Purge it the first time we successfully touch the key in Keychain, so a stale
// refresh token can't outlive the condition that created it. Once per key per
// process — `removeItem` on an absent key is cheap, but `getItem` runs on every
// token refresh and there's no reason to be chatty.
const purged = new Set<string>();
function purgeInsecureCopy(key: string): void {
  if (purged.has(key)) return;
  purged.add(key);
  AsyncStorage.removeItem(key).catch(() => {
    // Best effort. A failure here leaves the old plaintext copy, which is no
    // worse than before this change, and must never break auth.
  });
}

function warnKeychain(err: unknown): void {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(
    ALLOW_INSECURE_FALLBACK
      ? '[supabase] Keychain unavailable — falling back to AsyncStorage (DEV ONLY). ' +
          'Expected on unsigned simulator builds. Error:'
      : '[supabase] Keychain unavailable in a RELEASE build — the session will not ' +
          'be persisted. Auth material is never written to plaintext storage. Error:',
    (err as Error)?.message ?? String(err),
  );
}

async function trySecure<T>(
  key: string,
  op: () => Promise<T>,
  fallback: () => Promise<T>,
  onProductionFailure: () => T,
): Promise<T> {
  if (secureStoreUnavailable && ALLOW_INSECURE_FALLBACK) return fallback();
  try {
    const result = await op();
    purgeInsecureCopy(key);
    return result;
  } catch (err) {
    warnKeychain(err);
    if (!ALLOW_INSECURE_FALLBACK) return onProductionFailure();
    secureStoreUnavailable = true;
    return fallback();
  }
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string) =>
    trySecure(
      key,
      () => SecureStore.getItemAsync(key),
      () => AsyncStorage.getItem(key),
      () => null,
    ),
  setItem: (key: string, value: string) =>
    trySecure(
      key,
      () => SecureStore.setItemAsync(key, value),
      () => AsyncStorage.setItem(key, value),
      () => undefined,
    ),
  // removeItem additionally clears any AsyncStorage copy unconditionally. This is
  // the sign-out path: supabase-js calls it to drop the session, and a token left
  // behind in plaintext would survive sign-out entirely.
  removeItem: async (key: string) => {
    purged.delete(key); // force the purge below to actually run
    purgeInsecureCopy(key);
    return trySecure(
      key,
      () => SecureStore.deleteItemAsync(key),
      () => AsyncStorage.removeItem(key),
      () => undefined,
    );
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Same runtime instance, exposed as the generated `Database` type for code
// that's been migrated off the hand-written interfaces. Cast through unknown
// because the underlying client object is structurally identical — only the
// generic parameter differs at compile time.
export const supabaseTyped =
  supabase as unknown as SupabaseClient<GeneratedDatabase>;

// Convenience alias for code that wants to derive row/insert/update types:
//   type AccountRow = Tables<'users'>;
//   type AccountInsert = Database['public']['Tables']['users']['Insert'];
export type Tables<T extends keyof GeneratedDatabase['public']['Tables']> =
  GeneratedDatabase['public']['Tables'][T]['Row'];
