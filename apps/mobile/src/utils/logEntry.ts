// Pure logic for the baby tracker's log entries — validation, time math, and
// day grouping. Deliberately free of React Native and Supabase imports so it
// can be unit-tested without a simulator or a network. Everything here is a
// pure function of its arguments; `nowMs` is always injected, never read from
// the clock, so tests are deterministic.

export type LogKind = 'sleep' | 'feed' | 'diaper' | 'note';
export type FeedMethod = 'breast' | 'bottle';
export type BreastSide = 'left' | 'right';

// Subset of LogKind that runs as an open-ended timer (has a start with no
// guaranteed end) and can therefore go "runaway" if never closed out.
export type TimedKind = Extract<LogKind, 'sleep' | 'feed'>;

export type ValidationCode =
  | 'start_invalid' | 'start_future'
  | 'end_invalid' | 'end_future' | 'end_before_start'
  | 'side_required' | 'oz_on_breast' | 'side_on_bottle' | 'oz_out_of_range';

// `code` is machine-readable (for localizing this copy per-locale later);
// `reason` is the English default so today's call sites work unchanged.
export type ValidationResult =
  | { ok: true }
  | { ok: false; code: ValidationCode; reason: string };

export const MIN_OZ = 0;
export const MAX_OZ = 12;

// Ceilings past which an open session is unambiguously a forgotten timer.
// Deliberately generous: a mom logging overnight sleep has a legitimate 8h
// session, and nagging her about real data is worse than missing a stale row.
export const RUNAWAY_MS: Record<TimedKind, number> = {
  sleep: 12 * 3600_000,
  feed: 2 * 3600_000,
};

function ms(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** A start must parse, must not be in the future, and must not follow its end. */
export function validateInterval(
  startedAt: string, endedAt: string | null, nowMs: number,
): ValidationResult {
  const start = ms(startedAt);
  if (start == null) return { ok: false, code: 'start_invalid', reason: "That start time isn't a valid time." };
  if (start > nowMs) return { ok: false, code: 'start_future', reason: 'That start time is in the future.' };
  if (endedAt == null) return { ok: true };
  const end = ms(endedAt);
  if (end == null) return { ok: false, code: 'end_invalid', reason: "That end time isn't a valid time." };
  if (end > nowMs) return { ok: false, code: 'end_future', reason: 'That end time is in the future.' };
  if (end < start) return { ok: false, code: 'end_before_start', reason: 'The end time is before the start time.' };
  return { ok: true };
}

/** Breast feeds carry a side and no ounces; bottles carry ounces and no side. */
export function validateFeedShape(
  method: FeedMethod, side: BreastSide | null, amountOz: number | null,
): ValidationResult {
  if (method === 'breast') {
    if (!side) return { ok: false, code: 'side_required', reason: 'Pick a side — left or right.' };
    if (amountOz != null) return { ok: false, code: 'oz_on_breast', reason: 'Ounces only apply to a bottle.' };
    return { ok: true };
  }
  if (side) return { ok: false, code: 'side_on_bottle', reason: "A bottle doesn't have a side." };
  if (amountOz != null && (!Number.isFinite(amountOz) || amountOz < MIN_OZ || amountOz > MAX_OZ)) {
    return { ok: false, code: 'oz_out_of_range', reason: `Ounces must be between ${MIN_OZ} and ${MAX_OZ}.` };
  }
  return { ok: true };
}

/** Has an open session run long enough to be certainly a forgotten timer? */
export function isRunaway(kind: TimedKind, startedAt: string, nowMs: number): boolean {
  const start = ms(startedAt);
  if (start == null) return false;
  return nowMs - start > RUNAWAY_MS[kind];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Local calendar day key (YYYY-MM-DD).
 *
 * The tracker previously grouped on `iso.slice(0, 10)`, which is the UTC day.
 * For a mom in Miami an 8pm feed lands on the NEXT UTC day, which inflated the
 * distinct-day count in getRecentStats and therefore deflated feedsPerDay.
 * Always group on the day she actually lived.
 */
export function dayKeyLocal(iso: string): string {
  // A bare YYYY-MM-DD parses as UTC midnight, which lands on the previous day
  // in any negative-offset zone. Treat it as the local day it names — this
  // also makes the function's own output ('YYYY-MM-DD') safe to feed back in.
  if (DATE_ONLY.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inverse of dayKeyLocal — local midnight for a day key. */
export function startOfDayLocal(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface DayGroup<T> { dayKey: string; items: T[] }

/** Group items into local days, newest day first, preserving input order within a day. */
export function groupByDay<T>(items: T[], isoOf: (item: T) => string): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKeyLocal(isoOf(item));
    if (!key) continue; // unparseable — don't render a blank day heading
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()]
    .map(([dayKey, groupItems]) => ({ dayKey, items: groupItems }))
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : a.dayKey > b.dayKey ? -1 : 0));
}

/** ISO timestamp `minutes` before `nowMs` — powers the back-dating chips. */
export function minutesAgoISO(minutes: number, nowMs: number): string {
  return new Date(nowMs - minutes * 60_000).toISOString();
}

/**
 * Snap ounces to the nearest half and hold them inside the allowed range.
 *
 * MIN_OZ stays 0 even though the shipped stepper floors at 0.5 when
 * *starting* a bottle (0oz is meaningless there) — an edit may legitimately
 * record 0 for a bottle that was offered and refused.
 */
export function clampOz(n: number): number {
  if (Number.isNaN(n)) return MIN_OZ;
  if (n === Infinity) return MAX_OZ;
  if (n === -Infinity) return MIN_OZ;
  const snapped = Math.round(n * 2) / 2;
  return Math.min(MAX_OZ, Math.max(MIN_OZ, snapped));
}

/**
 * Was a key genuinely supplied?
 *
 * `'k' in patch` is not enough: tsconfig lacks exactOptionalPropertyTypes, so
 * `{ ended_at: undefined }` type-checks, satisfies `in`, and is then dropped by
 * JSON.stringify — validating one thing and writing another.
 */
export function has<T extends object, K extends keyof T>(patch: T, key: K): boolean {
  return key in patch && patch[key] !== undefined;
}

export interface FeedState {
  method: FeedMethod;
  side: BreastSide | null;
  started_at: string;
  ended_at: string | null;
  amount_oz: number | null;
}
export type FeedPatch = Partial<FeedState>;

export type MergeResult<T> =
  | { ok: true; payload: T }
  | { ok: false; code: ValidationCode; reason: string };

/**
 * Merge an edit onto a stored feed, normalise it, and validate the result.
 * Returns the exact row to write — never a partial patch — so what was
 * validated is what lands.
 */
export function mergeFeedPatch(
  current: FeedState, patch: FeedPatch, nowMs: number,
): MergeResult<FeedState> {
  const method = has(patch, 'method') ? patch.method! : current.method;
  const rawSide = has(patch, 'side') ? patch.side! : current.side;
  const rawOz = has(patch, 'amount_oz') ? patch.amount_oz! : current.amount_oz;
  const started_at = has(patch, 'started_at') ? patch.started_at! : current.started_at;
  const ended_at = has(patch, 'ended_at') ? patch.ended_at! : current.ended_at;

  // A method switch must never leave an orphan side or ounce behind.
  const side = method === 'bottle' ? null : rawSide;
  const amount_oz = method === 'breast' ? null : (rawOz == null ? null : clampOz(rawOz));

  const shape = validateFeedShape(method, side, amount_oz);
  if (!shape.ok) return shape;
  const interval = validateInterval(started_at, ended_at, nowMs);
  if (!interval.ok) return interval;
  return { ok: true, payload: { method, side, started_at, ended_at, amount_oz } };
}
