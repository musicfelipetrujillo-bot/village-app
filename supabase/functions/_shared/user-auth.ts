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

import { createClient } from 'jsr:@supabase/supabase-js@2.115.0';

import { publishableKey } from './keys.ts';
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
      publishableKey(),
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

export type TargetUser =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Resolves which user a request is allowed to act on, for the very common shape:
 * "the body names a `user_id`, and the function then reads or writes that user's
 * data with the service-role client".
 *
 * That shape was the single most repeated IDOR in this codebase (security audit
 * 2026-09-04): `user_id` was taken on trust, so any caller holding the anon key
 * could target anyone — reading a victim's pregnancy stage, due date, city or
 * insurance into an LLM prompt, or overwriting her generated rows.
 *
 * Rules:
 *   - service role  → may act on any user, including a body-supplied id. Internal
 *     fan-out (home-feed-curator, crons) legitimately curates for other people.
 *   - signed-in user → may act ONLY on herself. A body `user_id` naming someone
 *     else is REFUSED (403), not silently rewritten: a client sending the wrong id
 *     is a bug, and quietly "fixing" it hides the bug while looking like success.
 *   - anyone else   → 401.
 *
 * Callers should pass `isServiceRoleRequest(req, …)` in as `isService` so the
 * gatewayVerifiesJwt flag stays visible (and reviewable against config.toml) at
 * the call site rather than being buried here.
 */
export async function resolveTargetUser(
  req: Request,
  bodyUserId: string | null | undefined,
  isService: boolean,
): Promise<TargetUser> {
  if (isService) {
    if (!bodyUserId) return { ok: false, status: 403, error: 'user_id required' };
    return { ok: true, userId: bodyUserId };
  }
  const caller = await getCallerUserId(req);
  if (!caller) return { ok: false, status: 401, error: 'unauthorized' };
  if (bodyUserId && bodyUserId !== caller) {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  return { ok: true, userId: caller };
}
