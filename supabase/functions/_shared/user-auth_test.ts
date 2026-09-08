// Unit tests for the user-JWT gate — test coverage plan, tier 2.
//
// `resolveTargetUser` is the fix for the single most repeated bug in this
// codebase: a body-supplied `user_id` taken on trust, so any caller holding the
// anon key could name someone else and have the function read or write THAT
// user's data with the service key. Ten functions were remediated on
// 2026-09-05, all routed through this one helper.
//
// The tests run against a LOCAL STUB of the Supabase Auth endpoint rather than
// a mock of our own function. Stubbing `getCallerUserId` itself would test
// nothing — the interesting question is whether the helper actually validates
// the token over the wire and behaves correctly on each answer.
//
// Run:  deno test --allow-env --allow-net supabase/functions/_shared/user-auth_test.ts

import { assertEquals } from 'jsr:@std/assert@1.0.8';
import { getCallerUserId, isAuthenticatedUser, resolveTargetUser } from './user-auth.ts';

const ALICE = 'aaaaaaaa-0000-4000-8000-000000000001';
const BOB = 'bbbbbbbb-0000-4000-8000-000000000002';
const GOOD_TOKEN = 'good-token-for-alice';

/** Stands in for GoTrue. Answers /auth/v1/user based on the bearer presented. */
function startAuthStub() {
  const server = Deno.serve({ port: 0, onListen: () => {} }, (req) => {
    const url = new URL(req.url);
    if (!url.pathname.endsWith('/auth/v1/user')) {
      return new Response('not found', { status: 404 });
    }
    const auth = req.headers.get('Authorization') ?? '';
    if (auth === `Bearer ${GOOD_TOKEN}`) {
      return Response.json({
        id: ALICE,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'alice@example.test',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-01-01T00:00:00Z',
      });
    }
    return Response.json({ message: 'invalid claim: missing sub claim' }, { status: 401 });
  });
  return {
    url: `http://127.0.0.1:${(server.addr as Deno.NetAddr).port}`,
    stop: () => server.shutdown(),
  };
}

function req(authorization?: string): Request {
  return new Request('https://example.test/', {
    method: 'POST',
    headers: authorization ? { Authorization: authorization } : {},
  });
}

async function withStub(fn: () => Promise<void>) {
  const stub = startAuthStub();
  const priorUrl = Deno.env.get('SUPABASE_URL');
  const priorKey = Deno.env.get('SUPABASE_ANON_KEY');
  // See the note in service-role_test.ts: publishableKey() prefers these, so a
  // developer's exported values would shadow the stub if left in place.
  const priorDict = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  const priorSingle = Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  Deno.env.delete('SUPABASE_PUBLISHABLE_KEYS');
  Deno.env.delete('SUPABASE_PUBLISHABLE_KEY');
  Deno.env.set('SUPABASE_URL', stub.url);
  Deno.env.set('SUPABASE_ANON_KEY', 'stub-anon-key');
  try {
    await fn();
  } finally {
    if (priorUrl === undefined) Deno.env.delete('SUPABASE_URL'); else Deno.env.set('SUPABASE_URL', priorUrl);
    if (priorKey === undefined) Deno.env.delete('SUPABASE_ANON_KEY'); else Deno.env.set('SUPABASE_ANON_KEY', priorKey);
    if (priorDict !== undefined) Deno.env.set('SUPABASE_PUBLISHABLE_KEYS', priorDict);
    if (priorSingle !== undefined) Deno.env.set('SUPABASE_PUBLISHABLE_KEY', priorSingle);
    await stub.stop();
  }
}

// ── getCallerUserId ────────────────────────────────────────────────────────

Deno.test('getCallerUserId resolves the user behind a valid token', async () => {
  await withStub(async () => {
    assertEquals(await getCallerUserId(req(`Bearer ${GOOD_TOKEN}`)), ALICE);
  });
});

Deno.test('getCallerUserId returns null with no Authorization header', async () => {
  await withStub(async () => {
    assertEquals(await getCallerUserId(req()), null);
  });
});

Deno.test('getCallerUserId returns null for a token Auth rejects', async () => {
  await withStub(async () => {
    assertEquals(await getCallerUserId(req('Bearer some-other-token')), null);
  });
});

Deno.test('getCallerUserId fails CLOSED when Auth is unreachable', async () => {
  // A transient network problem must be indistinguishable from "not signed in",
  // never from "signed in". The helper catches and returns null for exactly this.
  const priorUrl = Deno.env.get('SUPABASE_URL');
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:1');   // nothing listens here
  Deno.env.set('SUPABASE_ANON_KEY', 'stub-anon-key');
  try {
    assertEquals(await getCallerUserId(req(`Bearer ${GOOD_TOKEN}`)), null);
  } finally {
    if (priorUrl === undefined) Deno.env.delete('SUPABASE_URL'); else Deno.env.set('SUPABASE_URL', priorUrl);
  }
});

Deno.test('isAuthenticatedUser mirrors getCallerUserId', async () => {
  await withStub(async () => {
    assertEquals(await isAuthenticatedUser(req(`Bearer ${GOOD_TOKEN}`)), true);
    assertEquals(await isAuthenticatedUser(req('Bearer nope')), false);
    assertEquals(await isAuthenticatedUser(req()), false);
  });
});

// ── resolveTargetUser: the service-role branch ─────────────────────────────

Deno.test('service role may target any user', async () => {
  await withStub(async () => {
    assertEquals(await resolveTargetUser(req(), BOB, true), { ok: true, userId: BOB });
  });
});

Deno.test('service role with no user_id is refused', async () => {
  await withStub(async () => {
    assertEquals(await resolveTargetUser(req(), null, true), {
      ok: false, status: 403, error: 'user_id required',
    });
  });
});

// ── resolveTargetUser: the user branch — THE IDOR TESTS ────────────────────

Deno.test('an unauthenticated caller is refused with 401', async () => {
  await withStub(async () => {
    assertEquals(await resolveTargetUser(req(), ALICE, false), {
      ok: false, status: 401, error: 'unauthorized',
    });
  });
});

Deno.test('a signed-in user with no body user_id acts on herself', async () => {
  await withStub(async () => {
    assertEquals(await resolveTargetUser(req(`Bearer ${GOOD_TOKEN}`), null, false), {
      ok: true, userId: ALICE,
    });
  });
});

Deno.test('a signed-in user naming her OWN id is allowed', async () => {
  await withStub(async () => {
    assertEquals(await resolveTargetUser(req(`Bearer ${GOOD_TOKEN}`), ALICE, false), {
      ok: true, userId: ALICE,
    });
  });
});

Deno.test('a signed-in user naming SOMEONE ELSE is REFUSED, not retargeted', async () => {
  // The whole finding, in one assertion. Note the shape of the failure: 403,
  // not a silent rewrite to Alice. Quietly "fixing" the id would hide a client
  // bug behind an apparent success — and would make this test pass while the
  // vulnerability it describes was reintroduced.
  await withStub(async () => {
    const result = await resolveTargetUser(req(`Bearer ${GOOD_TOKEN}`), BOB, false);
    assertEquals(result, { ok: false, status: 403, error: 'forbidden' });
  });
});

Deno.test('an invalid token naming another user is 401, not 403', async () => {
  // Status codes are load-bearing here: 401 says "who are you", 403 says "not
  // yours". Collapsing them would tell an unauthenticated prober that the id
  // they guessed is real.
  await withStub(async () => {
    assertEquals(await resolveTargetUser(req('Bearer nope'), BOB, false), {
      ok: false, status: 401, error: 'unauthorized',
    });
  });
});
