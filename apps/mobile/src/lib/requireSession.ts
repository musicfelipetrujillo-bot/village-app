// Guard for reads whose RLS policies are scoped to the `authenticated` role.
//
// THE FAILURE THIS EXISTS TO PREVENT
// ----------------------------------
// supabase-js does not queue queries until auth is ready. A `supabase.from(...)`
// or `supabase.rpc(...)` issued while the client is still restoring or
// refreshing its session goes out with NO Authorization JWT — PostgREST then
// evaluates it as `anon`.
//
// For a table whose only SELECT policy is `TO authenticated`, that does not
// fail. It returns **HTTP 200 with zero rows** — `[]` for a table read, `null`
// for a scalar RPC. The client cannot tell that apart from "there genuinely
// isn't any", so the UI renders an honest-looking empty state and never
// retries.
//
// Measured on production edge_logs for 2026-08-14 → 15, all traffic from
// `villie/14`:
//   get_trending_issue   21 of 58 calls (36%) arrived with no JWT
//   baby_feed_logs       38 of 42 (90%)
//   baby_sleep_logs      38 of 42 (90%)
//   baby_diaper_logs     28 of 31 (90%)
// Every one of them answered 200. That is why The Buzz card kept vanishing
// from Home on launch.
//
// Awaiting getSession() first forces supabase-js to finish restoring (and
// refreshing, if the access token has expired) before the request is built, so
// the JWT is attached. This is the same guard `homeApi.getMyBabyProfile` and
// `useHomeStore.fetchAll` already use — and the reason Home's own data never
// showed this symptom while The Buzz did.
//
// Throwing (rather than returning null) is deliberate, and is the lesson
// already written into homeApi: "No session" is NOT "no data". Callers must be
// able to tell "she has none" from "we couldn't find out", so a transient gap
// never gets written over real content.
import { supabase } from '@/lib/supabase';

/** Thrown when a read ran before the session was available. Transient — retry. */
export const NO_SESSION = 'no_session';

export function isNoSession(err: unknown): boolean {
  return err instanceof Error && err.message === NO_SESSION;
}

/**
 * Resolve the current session, throwing `no_session` if there isn't one.
 *
 * Uses getSession() rather than getUser(): getSession reads the stored session
 * locally and only hits the network when the token needs refreshing, whereas
 * getUser() always adds a /auth/v1/user round-trip — on the exact code path
 * that has to survive a cold start with a half-awake radio.
 */
export async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error(NO_SESSION);
  return session;
}
