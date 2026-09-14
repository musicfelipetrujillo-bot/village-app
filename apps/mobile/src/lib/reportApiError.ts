// reportApiError — one place that decides what a failed API call is worth.
//
// WHY THIS EXISTS
// ---------------
// Every store and api module caught its failures and called `console.error`.
// In a dev build that prints to Metro; in a shipped build it goes nowhere at
// all. Sentry is initialised but nothing forwards console output to it, so a
// failure that only ever reached `console.error` was invisible in production.
//
// That was found the hard way (2026-09-13): a dev simulator logged nine
// `fetchUpcoming` failures — `TypeError: Network request failed` and
// `Gateway Timeout` — over three hours, while 90 direct requests to the same
// endpoint from the same machine all succeeded. The endpoint was healthy; the
// app was not. The question that mattered — "are mothers hitting this too?" —
// could not be answered, because nothing about it was ever reported. The only
// reason we saw it at all is that someone happened to be tailing Metro.
//
// This does not fix flaky transport. It makes it COUNTABLE.
//
// DESIGN NOTES
// ------------
// * Transport failures are reported at `warning`, not `error`. A dropped
//   request is not a crash, and filing it as one trains people to ignore the
//   alert that eventually matters.
// * Everything is fingerprinted by operation + kind, so a thousand dropped
//   requests collapse into one issue with a count — which is exactly the shape
//   of the question being asked.
// * Throttled per fingerprint. These fire on screen focus, so a mother
//   navigating during an outage could otherwise generate hundreds of events
//   and burn the quota on a single bad afternoon.
// * No request payloads, no user data. The operation name and the failure kind
//   are enough to answer the question; anything else is a HIPAA-adjacent
//   liability for a file whose whole job is to be called from everywhere.
import { Sentry } from './sentry';

export type ApiFailureKind =
  /** The request never completed — dropped socket, DNS, gateway timeout. */
  | 'transport'
  /** It completed and the server said it went wrong (5xx). */
  | 'server'
  /** It completed and the API rejected it (PostgREST error, 4xx, RLS). */
  | 'api';

/** One report per fingerprint per this long. */
const THROTTLE_MS = 60_000;
const lastSentAt = new Map<string, number>();

// React Native's fetch rejects with `TypeError: Network request failed` for
// every transport-level problem, so the message is the only signal available.
// `Gateway Timeout` / `Bad Gateway` arrive as the HTTP status text once
// supabase-js turns a 5xx into an Error.
const TRANSPORT_PATTERNS = [
  /network request failed/i,
  /gateway timeout/i,
  /bad gateway/i,
  /service unavailable/i,
  /timeout/i,
  /aborted/i,
  /failed to fetch/i,
];

/**
 * The message, however the failure arrived. supabase-js hands back PostgREST
 * errors as PLAIN OBJECTS with a `message`, not Error instances — `String(err)`
 * on one of those yields "[object Object]", which is worse than useless in an
 * issue title.
 */
function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err ?? '');
}

export function classifyApiFailure(err: unknown): ApiFailureKind {
  const message = messageOf(err);
  if (TRANSPORT_PATTERNS.some((re) => re.test(message))) return 'transport';
  // PostgREST errors carry a `code`; anything with one completed the round trip.
  if (err && typeof err === 'object' && 'code' in err) return 'api';
  const status = (err as { status?: number } | null)?.status;
  if (typeof status === 'number') {
    // 502/503/504 are the gateway saying it could not reach or wait for the
    // backend — the same transient condition as a dropped socket, and it should
    // not page anyone. A bare 500 is the server itself failing, which is a bug.
    if (status === 502 || status === 503 || status === 504) return 'transport';
    return status >= 500 ? 'server' : 'api';
  }
  return 'api';
}

/**
 * Log a failed API call and report it to Sentry.
 *
 * Replaces a bare `console.error` at a catch site — it still logs to the
 * console, so the Metro signal developers rely on is unchanged.
 *
 * @param operation dotted name of the call, e.g. `events.fetchUpcoming`.
 *                  Becomes the Sentry tag and part of the fingerprint, so keep
 *                  it stable — renaming it splits the issue history.
 * @param context   small, non-identifying extras (counts, flags). Never pass
 *                  request bodies, tokens, or anything about the mother.
 */
export function reportApiError(
  operation: string,
  err: unknown,
  context?: Record<string, string | number | boolean | null>,
): void {
  const kind = classifyApiFailure(err);

  // Console level tracks the Sentry level: a dropped request is a warning, an
  // API/server rejection is an error. Call sites that deliberately used `warn`
  // because they degrade gracefully keep that volume in Metro.
  const log = kind === 'transport' ? console.warn : console.error;
  log(`[${operation}]`, err);

  try {
    const fingerprint = `${operation}:${kind}`;

    const now = Date.now();
    const previous = lastSentAt.get(fingerprint);
    if (previous !== undefined && now - previous < THROTTLE_MS) return;
    lastSentAt.set(fingerprint, now);

    const error = err instanceof Error ? err : new Error(messageOf(err) || 'unknown API failure');
    // PostgREST codes are the single most useful field for triaging an `api`
    // failure (42501 = RLS refusal, PGRST205 = missing table, ...).
    const code = (err as { code?: unknown } | null)?.code;

    Sentry.captureException(error, {
      level: kind === 'transport' ? 'warning' : 'error',
      tags: {
        api_operation: operation,
        api_failure_kind: kind,
        ...(typeof code === 'string' ? { api_error_code: code } : {}),
      },
      // Group by what failed and how, NOT by message — transport errors carry
      // wildly varying text for the same underlying condition.
      fingerprint: ['api-failure', operation, kind],
      extra: context,
    });
  } catch {
    // Telemetry must never be able to break the call site it is reporting on.
  }
}

/** Test seam — throttling is module state that would otherwise leak between tests. */
export function __resetApiErrorThrottle(): void {
  lastSentAt.clear();
}
