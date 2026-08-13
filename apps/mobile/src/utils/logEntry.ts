// Pure logic for the baby tracker's log entries — validation, time math, and
// day grouping. Deliberately free of React Native and Supabase imports so it
// can be unit-tested without a simulator or a network. Everything here is a
// pure function of its arguments; `nowMs` is always injected, never read from
// the clock, so tests are deterministic.

export type LogKind = 'sleep' | 'feed' | 'diaper' | 'note';
export type FeedMethod = 'breast' | 'bottle';
export type BreastSide = 'left' | 'right';

export interface ValidationResult { ok: boolean; reason?: string }

export const MIN_OZ = 0;
export const MAX_OZ = 12;

// Ceilings past which an open session is unambiguously a forgotten timer.
// Deliberately generous: a mom logging overnight sleep has a legitimate 8h
// session, and nagging her about real data is worse than missing a stale row.
export const RUNAWAY_MS: Record<'sleep' | 'feed', number> = {
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
  if (start == null) return { ok: false, reason: "That start time isn't a valid time." };
  if (start > nowMs) return { ok: false, reason: 'That start time is in the future.' };
  if (endedAt == null) return { ok: true };
  const end = ms(endedAt);
  if (end == null) return { ok: false, reason: "That end time isn't a valid time." };
  if (end > nowMs) return { ok: false, reason: 'That end time is in the future.' };
  if (end < start) return { ok: false, reason: 'The end time is before the start time.' };
  return { ok: true };
}

/** Breast feeds carry a side and no ounces; bottles carry ounces and no side. */
export function validateFeedShape(
  method: FeedMethod, side: BreastSide | null, amountOz: number | null,
): ValidationResult {
  if (method === 'breast') {
    if (!side) return { ok: false, reason: 'Pick a side — left or right.' };
    if (amountOz != null) return { ok: false, reason: 'Ounces only apply to a bottle.' };
    return { ok: true };
  }
  if (side) return { ok: false, reason: "A bottle doesn't have a side." };
  if (amountOz != null && (amountOz < MIN_OZ || amountOz > MAX_OZ)) {
    return { ok: false, reason: `Ounces must be between ${MIN_OZ} and ${MAX_OZ}.` };
  }
  return { ok: true };
}

/** Has an open session run long enough to be certainly a forgotten timer? */
export function isRunaway(kind: 'sleep' | 'feed', startedAt: string, nowMs: number): boolean {
  const start = ms(startedAt);
  if (start == null) return false;
  return nowMs - start > RUNAWAY_MS[kind];
}

/**
 * Local calendar day key (YYYY-MM-DD).
 *
 * The tracker previously grouped on `iso.slice(0, 10)`, which is the UTC day.
 * For a mom in Miami an 8pm feed lands on the NEXT UTC day, which inflated the
 * distinct-day count in getRecentStats and therefore deflated feedsPerDay.
 * Always group on the day she actually lived.
 */
export function dayKeyLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface DayGroup<T> { dayKey: string; items: T[] }

/** Group items into local days, newest day first, preserving input order within a day. */
export function groupByDay<T>(items: T[], isoOf: (item: T) => string): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKeyLocal(isoOf(item));
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

/** Snap ounces to the nearest half and hold them inside the allowed range. */
export function clampOz(n: number): number {
  if (!Number.isFinite(n)) return MIN_OZ;
  const snapped = Math.round(n * 2) / 2;
  return Math.min(MAX_OZ, Math.max(MIN_OZ, snapped));
}
