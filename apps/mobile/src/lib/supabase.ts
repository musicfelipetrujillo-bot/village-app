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

// Auth storage adapter — SecureStore (iOS Keychain) by default, falls back
// to AsyncStorage on the first Keychain failure. This handles:
//   1. iOS Simulator dev builds: when xcodebuild runs with
//      CODE_SIGNING_ALLOWED=NO (no Apple Dev cert on machine), the app's
//      `application-identifier` entitlement isn't set, so every Keychain
//      call throws "A required entitlement isn't present." Sim dev only —
//      Release builds going through TestFlight / App Store are signed
//      properly and use Keychain.
//   2. Any other transient Keychain glitch (locked Keychain, restored
//      backup mid-launch, etc.) — falls back gracefully rather than
//      hanging the auth bootstrap.
//
// Logs the fallback once per process so it's visible in sim logs but
// doesn't spam.
let secureStoreUnavailable = false;
async function trySecure<T>(op: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (secureStoreUnavailable) return fallback();
  try {
    return await op();
  } catch (err) {
    if (!secureStoreUnavailable) {
      secureStoreUnavailable = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[supabase] Keychain unavailable — falling back to AsyncStorage. ' +
          'Expected on unsigned simulator builds; Release builds via ' +
          'TestFlight/App Store sign properly and use Keychain. Error:',
        (err as Error)?.message ?? String(err),
      );
    }
    return fallback();
  }
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string) =>
    trySecure(() => SecureStore.getItemAsync(key), () => AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) =>
    trySecure(
      () => SecureStore.setItemAsync(key, value),
      () => AsyncStorage.setItem(key, value),
    ),
  removeItem: (key: string) =>
    trySecure(() => SecureStore.deleteItemAsync(key), () => AsyncStorage.removeItem(key)),
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
