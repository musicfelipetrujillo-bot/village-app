// Test coverage plan, tier 4 — the session guard.
//
// This is the highest-consequence pure logic in the app, and the reason the
// vitest glob had to be widened past `src/utils/**`: it lives in lib/, so under
// the old configuration it could not be tested at all.
//
// WHAT IT GUARDS. supabase-js does not queue queries until auth is ready, so a
// read issued while the session is still being restored goes out with NO JWT and
// PostgREST evaluates it as `anon`. Against a table whose only SELECT policy is
// `TO authenticated`, that does not error — it returns HTTP 200 with zero rows.
// "Not signed in yet" and "she has no data" become indistinguishable, and the UI
// renders an honest-looking empty state that never retries. Production edge_logs
// for 2026-08-14/15: 90% of baby_feed_logs, baby_sleep_logs and baby_diaper_logs
// reads arrived with no JWT, and every one answered 200.
//
// So the single most important assertion here is that requireSession THROWS
// rather than returning something falsy. A guard that returned null would let a
// caller write `?? []` and reintroduce the exact bug it exists to prevent.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSession = vi.fn();

// Mocked because the real module constructs a Supabase client at import time and
// reaches for expo-secure-store. The mock is the module boundary, not the logic
// under test — every branch below is this file's own code.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: () => getSession() } },
}));

const { requireSession, sessionReady, isNoSession, NO_SESSION } =
  await import('./requireSession');

const session = (user: unknown) => ({ data: { session: user ? { user } : null } });

beforeEach(() => getSession.mockReset());

describe('requireSession', () => {
  it('returns the session when one is present', async () => {
    getSession.mockResolvedValue(session({ id: 'user-1' }));
    const result = await requireSession();
    expect(result.user).toEqual({ id: 'user-1' });
  });

  it('THROWS when there is no session — never returns a falsy value', async () => {
    // The whole point. Returning null here would let callers write `?? []` and
    // silently render an empty screen, which is the bug this guard exists for.
    getSession.mockResolvedValue(session(null));
    await expect(requireSession()).rejects.toThrow(NO_SESSION);
  });

  it('throws when a session object exists but carries no user', async () => {
    // A refreshing client can hand back a session shell. `session?.user` is the
    // check that matters, not `session`.
    getSession.mockResolvedValue({ data: { session: { user: null } } });
    await expect(requireSession()).rejects.toThrow(NO_SESSION);
  });

  it('awaits getSession before deciding', async () => {
    // The await is the mechanism, not a formality: it forces supabase-js to
    // finish restoring so the JWT is attached to the NEXT request. A synchronous
    // read of a cached value would defeat the guard entirely.
    let settle: (v: unknown) => void = () => {};
    getSession.mockReturnValue(new Promise((r) => { settle = r; }));
    let done = false;
    const p = requireSession().then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    settle(session({ id: 'user-1' }));
    await p;
    expect(done).toBe(true);
  });
});

describe('isNoSession', () => {
  it('recognises the guard error so callers can retry instead of blanking the UI', async () => {
    getSession.mockResolvedValue(session(null));
    const err = await requireSession().catch((e) => e);
    expect(isNoSession(err)).toBe(true);
  });

  it('does NOT claim ownership of unrelated errors', () => {
    // A network failure must not be mistaken for "signed out" — the two call for
    // different handling, and conflating them is how a real error gets swallowed.
    expect(isNoSession(new Error('Failed to fetch'))).toBe(false);
    expect(isNoSession('no_session')).toBe(false);
    expect(isNoSession(null)).toBe(false);
    expect(isNoSession(undefined)).toBe(false);
  });
});

describe('sessionReady', () => {
  it('is true with a session and false without', async () => {
    getSession.mockResolvedValue(session({ id: 'user-1' }));
    expect(await sessionReady()).toBe(true);

    getSession.mockResolvedValue(session(null));
    expect(await sessionReady()).toBe(false);
  });

  it('returns false rather than rejecting when auth misbehaves', async () => {
    // Its callers are fire-and-forget effects, where a rejection surfaces as an
    // unhandled promise rejection rather than a handled "not ready".
    //
    // The fault is injected as a MALFORMED RESPONSE rather than a throwing mock.
    // Both reach the same catch, but a mock that throws (or returns a rejected
    // promise) is separately recorded by vitest and re-reported as an unhandled
    // error, failing the test even though the code handled it — confirmed by
    // running the identical call in isolation, where it returns false. An
    // undefined response destructures into a TypeError inside requireSession,
    // which is the same class of unexpected fault and stays inside the harness.
    getSession.mockResolvedValue(undefined);
    const result = await sessionReady();
    expect(result).toBe(false);
  });
});
