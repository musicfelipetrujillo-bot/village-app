// Unit tests for the service-role gate — test coverage plan, tier 2.
//
// This file is 107 lines that decide access for 37 endpoints, including every
// cron and every admin path. It is the single highest-leverage piece of code in
// the backend, and until now nothing tested it.
//
// The tests are organised around the two modes, because the whole defect class
// this helper was written to kill lives in the difference between them:
//
//   gatewayVerifiesJwt: false → nothing but the exact key is trustworthy
//   gatewayVerifiesJwt: true  → the platform already verified the signature, so
//                               a service_role claim is authentic
//
// Run:  deno test --allow-env supabase/functions/_shared/service-role_test.ts

import { assertEquals } from 'jsr:@std/assert@1.0.8';
import { isServiceRoleRequest, constantTimeEquals } from './service-role.ts';

const REAL_KEY = 'real-service-role-key-value-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

/** Builds a JWT-SHAPED string. The signature segment is junk — that is the point. */
function unsignedToken(payload: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${b64}.not-a-real-signature`;
}

function reqWith(authorization?: string): Request {
  return new Request('https://example.test/', {
    method: 'POST',
    headers: authorization ? { Authorization: authorization } : {},
  });
}

function withKey(key: string, fn: () => void) {
  // `secretKey()` prefers SUPABASE_SECRET_KEYS over the legacy name, so those
  // must be cleared or a developer with them exported would silently test their
  // own key instead of this stub — a green run proving nothing.
  const priorDict = Deno.env.get('SUPABASE_SECRET_KEYS');
  const priorSingle = Deno.env.get('SUPABASE_SECRET_KEY');
  const prior = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  Deno.env.delete('SUPABASE_SECRET_KEYS');
  Deno.env.delete('SUPABASE_SECRET_KEY');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', key);
  try { fn(); } finally {
    if (prior === undefined) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', prior);
    if (priorDict !== undefined) Deno.env.set('SUPABASE_SECRET_KEYS', priorDict);
    if (priorSingle !== undefined) Deno.env.set('SUPABASE_SECRET_KEY', priorSingle);
  }
}

// ── the shape of the header ────────────────────────────────────────────────

Deno.test('no Authorization header is refused', () => {
  withKey(REAL_KEY, () => {
    assertEquals(isServiceRoleRequest(reqWith(), { gatewayVerifiesJwt: true }), false);
    assertEquals(isServiceRoleRequest(reqWith(), { gatewayVerifiesJwt: false }), false);
  });
});

Deno.test('a non-Bearer Authorization scheme is refused', () => {
  withKey(REAL_KEY, () => {
    assertEquals(isServiceRoleRequest(reqWith(`Basic ${REAL_KEY}`), { gatewayVerifiesJwt: true }), false);
  });
});

// ── mode 1: the exact key ──────────────────────────────────────────────────

Deno.test('the exact injected key is accepted in BOTH modes', () => {
  withKey(REAL_KEY, () => {
    assertEquals(isServiceRoleRequest(reqWith(`Bearer ${REAL_KEY}`), { gatewayVerifiesJwt: false }), true);
    assertEquals(isServiceRoleRequest(reqWith(`Bearer ${REAL_KEY}`), { gatewayVerifiesJwt: true }), true);
  });
});

Deno.test('a near-miss key is refused (no prefix or length shortcut)', () => {
  withKey(REAL_KEY, () => {
    assertEquals(isServiceRoleRequest(reqWith(`Bearer ${REAL_KEY}x`), { gatewayVerifiesJwt: false }), false);
    assertEquals(isServiceRoleRequest(reqWith(`Bearer ${REAL_KEY.slice(0, -1)}`), { gatewayVerifiesJwt: false }), false);
  });
});

// ── THE CRITICAL ONE ───────────────────────────────────────────────────────
// This is the 2026-08-14 critical, as an assertion. Six functions had a gate
// that base64-decoded the bearer and trusted `role`, never reading the
// signature, and specialist-invite-create was deployed with the gateway check
// OFF — so `Bearer x.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.x` made anyone an admin.

Deno.test('a FORGED unsigned service_role claim is refused when the gateway does not verify', () => {
  withKey(REAL_KEY, () => {
    const forged = unsignedToken({ role: 'service_role' });
    assertEquals(isServiceRoleRequest(reqWith(`Bearer ${forged}`), { gatewayVerifiesJwt: false }), false);
  });
});

Deno.test('the same forged claim IS accepted when the gateway verifies — by design', () => {
  // Not a weakness: the platform has already rejected every request whose
  // signature did not verify, so by this point the claim cannot be forged. The
  // test pins the contract so nobody "hardens" mode 2 into rejecting the
  // rotated keys the crons actually use.
  withKey(REAL_KEY, () => {
    const claim = unsignedToken({ role: 'service_role' });
    assertEquals(isServiceRoleRequest(reqWith(`Bearer ${claim}`), { gatewayVerifiesJwt: true }), true);
  });
});

// ── THE OTHER CRITICAL ONE ─────────────────────────────────────────────────
// The load-bearing insight of the 2026-09-04 audit: the anon publishable key is
// a validly signed project JWT that ships inside the app. It clears the gateway.
// It must never clear this gate.

Deno.test('an authentically signed ANON token is refused in both modes', () => {
  withKey(REAL_KEY, () => {
    const anon = unsignedToken({ role: 'anon', iss: 'supabase' });
    assertEquals(isServiceRoleRequest(reqWith(`Bearer ${anon}`), { gatewayVerifiesJwt: true }), false);
    assertEquals(isServiceRoleRequest(reqWith(`Bearer ${anon}`), { gatewayVerifiesJwt: false }), false);
  });
});

Deno.test('an authenticated USER token is refused in both modes', () => {
  withKey(REAL_KEY, () => {
    const user = unsignedToken({ role: 'authenticated', sub: 'a-user-id' });
    assertEquals(isServiceRoleRequest(reqWith(`Bearer ${user}`), { gatewayVerifiesJwt: true }), false);
    assertEquals(isServiceRoleRequest(reqWith(`Bearer ${user}`), { gatewayVerifiesJwt: false }), false);
  });
});

// ── key rotation, the reason mode 2 exists ─────────────────────────────────

Deno.test('a DIFFERENT valid service-role key is accepted when the gateway verifies', () => {
  // This project has more than one validly signed service-role key in
  // circulation — GitHub Actions and the edge runtime hold different strings.
  // Strict equality alone 401s the crons, and that breakage is what caused
  // authentication to be DELETED from six functions. Mode 2 is the fix.
  withKey(REAL_KEY, () => {
    const rotated = unsignedToken({ role: 'service_role', iat: 1234567890 });
    assertEquals(isServiceRoleRequest(reqWith(`Bearer ${rotated}`), { gatewayVerifiesJwt: true }), true);
  });
});

// ── degenerate inputs ──────────────────────────────────────────────────────

Deno.test('garbage tokens are refused, not crashed on', () => {
  withKey(REAL_KEY, () => {
    for (const junk of ['', 'not.a.jwt', '...', 'a.b', 'a.!!!not-base64!!!.c', 'Bearer']) {
      assertEquals(isServiceRoleRequest(reqWith(`Bearer ${junk}`), { gatewayVerifiesJwt: true }), false);
    }
  });
});

Deno.test('an EMPTY configured key never matches an empty bearer', () => {
  // If the env var is unset, `expected` is '' — and a caller sending an empty
  // bearer must not slip through a naive equality check.
  withKey('', () => {
    assertEquals(isServiceRoleRequest(reqWith('Bearer  '), { gatewayVerifiesJwt: false }), false);
    assertEquals(isServiceRoleRequest(reqWith('Bearer x'), { gatewayVerifiesJwt: false }), false);
  });
});

// ── the compare primitive ──────────────────────────────────────────────────

Deno.test('constantTimeEquals matches only identical strings', () => {
  assertEquals(constantTimeEquals('abc', 'abc'), true);
  assertEquals(constantTimeEquals('abc', 'abd'), false);
  assertEquals(constantTimeEquals('', ''), true);
});

Deno.test('constantTimeEquals returns false on length mismatch instead of throwing', () => {
  // node:crypto timingSafeEqual THROWS when the buffers differ in length. An
  // uncaught throw here would surface as a 500, not a 401 — a different bug
  // wearing the same clothes.
  assertEquals(constantTimeEquals('short', 'much-longer-value'), false);
  assertEquals(constantTimeEquals('abc', ''), false);
});

Deno.test('constantTimeEquals handles multi-byte characters by byte length', () => {
  assertEquals(constantTimeEquals('café', 'café'), true);
  assertEquals(constantTimeEquals('café', 'cafe'), false);
});
