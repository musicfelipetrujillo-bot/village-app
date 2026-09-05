// Shared user-JWT gate for edge functions that a signed-in mobile user calls directly.
//
// WHY THIS EXISTS (security audit 2026-09-04 — docs/audits/security-2026-09-04.md):
// A large group of functions had no authorization at all, on the assumption that
// `verify_jwt = true` in config.toml made them "internal". It does not. The gateway
// only proves the bearer is signed by this project's JWT secret — and the anon
// publishable key is exactly such a token. It ships inside the mobile bundle and on
// the marketing site, so anyone who extracts it clears that bar.
//
// The practical consequence: any function whose only protection was `verify_jwt`
// was reachable by the whole internet. For functions that call PAID third-party
// APIs (Google Geocoding, Google Places, Go-UPC / UPCitemdb) or an LLM, that is a
// billable open tap.
//
// This is the counterpart to `service-role.ts`. Pick by who is supposed to call:
//   service-role.ts  → cron, admin scripts, other edge functions
//   user-auth.ts     → the mobile app, acting as a signed-in user
//
// Both exist because "is the caller allowed" cannot be answered by the gateway.

import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Resolves the signed-in caller from the request's own Authorization header,
 * or null when there isn't a valid user behind it.
 *
 * Uses the ANON key plus the caller's header so `getUser()` actually VALIDATES the
 * token against Supabase Auth. Never do this with the service-role key — that
 * client authenticates as the project and will happily accept anything.
 *
 * Returns null (never throws) so callers can shape their own 401 with their own
 * CORS headers.
 */
export async function getCallerUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  try {
    const scoped = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error } = await scoped.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    // Network blip talking to Auth, malformed header, etc. Fail CLOSED — an
    // unauthenticated request must never be indistinguishable from a transient error.
    return null;
  }
}

/**
 * True iff the request carries a valid, signed-in user.
 *
 * Use where the function needs "somebody real is asking" but does not act on a
 * specific record — e.g. a ZIP lookup or a barcode lookup. Where the function
 * reads or writes a particular user's data, use `getCallerUserId` and compare
 * against the target id instead: proving the caller is SOME user is not the same
 * as proving they are THAT user, and conflating the two is how IDORs happen.
 */
export async function isAuthenticatedUser(req: Request): Promise<boolean> {
  return (await getCallerUserId(req)) !== null;
}
