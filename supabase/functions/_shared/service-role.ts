// Shared service-role auth gate for admin / cron-invoked edge functions.
//
// WHY THIS EXISTS (appsec 2026-08-14 — see docs/audits/security-privacy-2026-08-14.md):
// Six functions had each grown their own copy of a gate that base64-decoded the
// bearer JWT and returned `payload.role === 'service_role'` WITHOUT VERIFYING
// THE SIGNATURE. A JWT is three base64 segments joined by dots; the signature
// segment was never read. Any caller could send
//
//     Authorization: Bearer x.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.x
//
// and be treated as an administrator. That was survivable ONLY where the
// gateway happened to be verifying signatures — and `specialist-invite-create`
// was deployed `--no-verify-jwt`, so for it the gate was fully bypassable by
// anyone on the internet.
//
// ─── The subtlety that matters ────────────────────────────────────────────
// The naive fix — compare the bearer against `SUPABASE_SERVICE_ROLE_KEY` — is
// NOT sufficient on its own here, and we learned this the hard way: this
// project has MORE THAN ONE valid service-role key in circulation. The key in
// GitHub Actions secrets and the key injected into the edge runtime are both
// correctly signed by the project's JWT secret but are not byte-identical
// (consistent with an API-key rotation that kept the same signing secret).
// Strict equality therefore 401s the nightly crons. That is exactly the
// breakage the original author hit — and "fixed" by deleting authentication.
//
// So the gate is explicitly two-mode, and the caller must state which:
//
//   gatewayVerifiesJwt: false  → the platform is NOT checking signatures, so
//                                nothing but the exact key is trustworthy.
//                                Claims are attacker-controlled. Exact match
//                                ONLY.
//
//   gatewayVerifiesJwt: true   → the platform already rejected every request
//                                whose signature didn't verify against the
//                                project JWT secret, so by the time we run, a
//                                `service_role` claim is authentic and cannot
//                                be forged. Accept the exact key OR that claim
//                                — which tolerates key rotation.
//
// The flag is not a guess: `supabase/config.toml` pins `verify_jwt` for every
// function, so what each caller passes here is checkable against that file in
// review. If you set a function to `verify_jwt = false`, you MUST pass false.

import { timingSafeEqual } from 'node:crypto';

export interface ServiceRoleGateOptions {
  /**
   * Does the Supabase gateway verify the JWT signature for THIS function?
   * Must match `verify_jwt` for this function in `supabase/config.toml`.
   * Required — there is no default, because guessing it wrong is the bug.
   */
  gatewayVerifiesJwt: boolean;
}

/**
 * True iff the request is an authentic service-role call.
 *
 * Legitimate callers: GitHub Actions crons, admin CLI scripts
 * (`pnpm specialist:invite`), and other edge functions fanning out server-side.
 */
export function isServiceRoleRequest(
  req: Request,
  opts: ServiceRoleGateOptions,
): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const presented = match[1].trim();

  // 1. Exact match against the injected key — always sufficient, always safe.
  const expected = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
  if (expected && constantTimeEquals(presented, expected)) return true;

  // 2. Only when the gateway has already authenticated the signature may we
  //    trust what the token says about itself.
  if (opts.gatewayVerifiesJwt) return hasServiceRoleClaim(presented);

  return false;
}

/**
 * Reads the `role` claim WITHOUT verifying the signature.
 *
 * NEVER call this directly as an auth gate. It is only sound downstream of a
 * layer that has already verified the signature (see the mode-2 note above).
 */
function hasServiceRoleClaim(token: string): boolean {
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return false;
    const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded))?.role === 'service_role';
  } catch {
    return false;
  }
}

/** Length-safe constant-time string compare. */
export function constantTimeEquals(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  // timingSafeEqual throws on length mismatch, so guard first. Length is not
  // secret (key length is public); only the contents are.
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
