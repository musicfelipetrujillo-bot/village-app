// Test coverage for the API failure reporter.
//
// WHAT THIS GUARDS. The reporter exists because a failure that only reached
// `console.error` was invisible in production — so the assertions that matter
// are the ones about what actually reaches Sentry, and about the two ways this
// could quietly stop working:
//
//   1. Misclassification. A dropped request filed at `error` severity trains
//      people to ignore the alert; a real RLS refusal filed at `warning` hides
//      the one that matters. The classifier is the whole safety margin.
//   2. Silent flooding. These fire on screen focus. Without the throttle, a
//      mother navigating during an outage burns the Sentry quota in an
//      afternoon, and the quota runs out exactly when the data is needed.
//
// It also pins the two shapes that bit us for real: supabase-js hands back
// PostgREST errors as PLAIN OBJECTS (so `String(err)` yields "[object Object]"),
// and RN's fetch reports every transport failure as `TypeError: Network request
// failed`.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const captureException = vi.fn();

// Mocked at the module boundary: the real module calls Sentry.init() and reads
// expo-constants at import time.
vi.mock('./sentry', () => ({ Sentry: { captureException: (...a: unknown[]) => captureException(...a) } }));

// Dynamic import after the mock, matching requireSession.test.ts — a static
// import here trips `import/first`, since the mock has to be declared above it.
const { reportApiError, classifyApiFailure, __resetApiErrorThrottle } =
  await import('./reportApiError');

beforeEach(() => {
  captureException.mockClear();
  __resetApiErrorThrottle();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('classifyApiFailure', () => {
  it('treats RN fetch failures as transport', () => {
    // The exact string RN produces — the only signal a dropped socket gives us.
    expect(classifyApiFailure(new TypeError('Network request failed'))).toBe('transport');
  });

  it('treats gateway status text as transport, not as an app error', () => {
    // Observed in the wild as `Error: Gateway Timeout` — 5 times in one session.
    expect(classifyApiFailure(new Error('Gateway Timeout'))).toBe('transport');
    expect(classifyApiFailure(new Error('Bad Gateway'))).toBe('transport');
  });

  it('treats a PostgREST error object as an api failure', () => {
    // Round trip completed; the database said no. Not the same thing at all.
    expect(classifyApiFailure({ code: '42501', message: 'permission denied' })).toBe('api');
  });

  it('uses status to separate gateway, server and api failures', () => {
    // Gateway statuses are the same transient condition as a dropped socket
    // even when the message says nothing useful — they must not page anyone.
    expect(classifyApiFailure({ status: 502, message: 'upstream down' })).toBe('transport');
    expect(classifyApiFailure({ status: 503, message: 'upstream down' })).toBe('transport');
    expect(classifyApiFailure({ status: 504, message: 'upstream down' })).toBe('transport');
    // A bare 500 is the server itself failing — that is a bug, not weather.
    expect(classifyApiFailure({ status: 500, message: 'boom' })).toBe('server');
    expect(classifyApiFailure({ status: 404, message: 'nope' })).toBe('api');
  });
});

describe('reportApiError', () => {
  it('reports transport failures at warning, not error', () => {
    reportApiError('events.fetchUpcoming', new TypeError('Network request failed'));
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1]).toMatchObject({ level: 'warning' });
  });

  it('reports api failures at error', () => {
    reportApiError('events.fetchUpcoming', { code: '42501', message: 'permission denied' });
    expect(captureException.mock.calls[0][1]).toMatchObject({ level: 'error' });
  });

  it('never sends "[object Object]" for a PostgREST error', () => {
    // The whole point: a plain object must not be stringified into a useless
    // issue title. The message has to survive.
    reportApiError('manual.listManualPieces', { code: 'PGRST205', message: 'relation does not exist' });
    const sent = captureException.mock.calls[0][0] as Error;
    expect(sent.message).toBe('relation does not exist');
    expect(sent.message).not.toContain('[object Object]');
  });

  it('tags the PostgREST code so an RLS refusal is triageable', () => {
    reportApiError('events.fetchUpcoming', { code: '42501', message: 'permission denied' });
    expect(captureException.mock.calls[0][1]).toMatchObject({
      tags: { api_operation: 'events.fetchUpcoming', api_failure_kind: 'api', api_error_code: '42501' },
    });
  });

  it('groups by operation and kind rather than by message', () => {
    // Transport errors carry varying text for one underlying condition; if they
    // fingerprinted by message they would shatter into unusable singletons.
    reportApiError('events.fetchUpcoming', new Error('Gateway Timeout'));
    expect(captureException.mock.calls[0][1]).toMatchObject({
      fingerprint: ['api-failure', 'events.fetchUpcoming', 'transport'],
    });
  });

  it('throttles repeats of the same failure', () => {
    for (let i = 0; i < 25; i++) {
      reportApiError('events.fetchUpcoming', new TypeError('Network request failed'));
    }
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('does not let one throttled operation mask a different one', () => {
    reportApiError('events.fetchUpcoming', new TypeError('Network request failed'));
    reportApiError('manual.getWeekIntroVideo', new TypeError('Network request failed'));
    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it('does not let a transport failure mask a real api failure on the same call', () => {
    // The dangerous throttle bug: an outage suppressing the RLS regression that
    // started during it.
    reportApiError('events.fetchUpcoming', new TypeError('Network request failed'));
    reportApiError('events.fetchUpcoming', { code: '42501', message: 'permission denied' });
    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it('still logs to the console when Sentry throws', () => {
    captureException.mockImplementationOnce(() => { throw new Error('sentry is down'); });
    expect(() => reportApiError('events.fetchUpcoming', new Error('Gateway Timeout'))).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });
});
