import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
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

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
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
