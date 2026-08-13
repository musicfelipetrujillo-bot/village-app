# Editable, Flexible Baby Logging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the V5 baby tracker correctable and flexible — edit or delete any log, stamp logs at the time they actually happened, rescue forgotten timers, and browse/fix past days.

**Architecture:** Keep the four log tables from migration 093 and unify at the API layer behind a `LogEntry` discriminated union, so edit/delete need no migration (093 already grants owner `UPDATE`/`DELETE`). All pure logic — validation, time math, day grouping — lives in a dependency-free module so it can be unit-tested. One migration (123) links AI-parsed rows back to their source note.

**Tech Stack:** React Native + Expo (managed), Zustand, Supabase JS, TypeScript. Tests: vitest (added by Task 0, scoped to pure-logic modules only).

**Spec:** `docs/superpowers/specs/2026-08-13-log-editing-design.md`

---

## Two constraints that shape everything

**1. Everything must stay OTA-able.** The founder ships via `eas update`. A native module would gate all of this behind a native build, and pod-install on this project is fragile (see `reference_ios_modular_headers_fix`). Therefore: **no new native dependencies.** The date/time control is pure JS, modeled on the ± hour stepper already shipped in `apps/mobile/src/screens/me/NotificationPreferencesScreen.tsx` (`bumpHour` / `formatHour` / `stepperRow` styles). Task 10's migration is the only step needing a deploy, and it is sequenced last.

**2. This repo has no test harness.** Task 0 adds vitest scoped to pure-logic modules. UI and Supabase calls are verified by `type-check`, `lint`, and driving the simulator against the seeded month from Task 4. Do not claim a UI task is verified without having actually run it in the simulator.

## File structure

| File | Responsibility |
|---|---|
| `apps/mobile/src/utils/logEntry.ts` | **Create.** Pure validation + time math + day grouping. Zero imports from React Native or Supabase — this is what makes it testable. |
| `apps/mobile/src/utils/logEntry.test.ts` | **Create.** Unit tests for the above. |
| `apps/mobile/vitest.config.ts` | **Create.** Test runner config, scoped to `src/utils/*.test.ts`. |
| `apps/mobile/src/api/babyTracker.ts` | **Modify.** Add `LogEntry`, update/delete methods, `getDay`/`getRange`/`getOpenSessions`; fix the `stopFeed` oz bug and the UTC `dayKey` bug. |
| `apps/mobile/src/store/babyTracker.ts` | **Modify.** Add `updateEntry`/`deleteEntry`; thread optional timestamps through the log actions. |
| `scripts/seed-baby-logs.mjs` | **Create.** Month-long seed harness, dry-run by default. |
| `apps/mobile/src/components/tracker/LogTimeline.tsx` | **Create.** Timeline rows, extracted from `PlaybookTracker` so History can reuse them. |
| `apps/mobile/src/components/tracker/TimeField.tsx` | **Create.** Pure-JS date + time control. |
| `apps/mobile/src/components/tracker/TimeChips.tsx` | **Create.** now / 15m / 30m / 1h / ⌄ row for back-dating at log time. |
| `apps/mobile/src/components/tracker/LogEditSheet.tsx` | **Create.** One bottom sheet, driven by `entry.kind`. |
| `apps/mobile/src/components/manual/PlaybookTracker.tsx` | **Modify.** Use the extracted timeline, add time chips, add the runaway rescue. |
| `apps/mobile/src/screens/home/LogHistoryScreen.tsx` | **Create.** Day-grouped, paged history. |
| `apps/mobile/src/navigation/HomeNavigator.tsx` | **Modify.** Register `LogHistory`. |
| `supabase/migrations/123_baby_log_note_linkage.sql` | **Create.** `note_id` FK on the three log tables. |
| `supabase/functions/playbook-parse-note/index.ts` | **Modify.** Stamp `note_id` on inserted rows. |

---

## Task 0: Test harness for pure logic

**Files:**
- Create: `apps/mobile/vitest.config.ts`
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Add vitest as a dev dependency**

```bash
cd "/Users/gp/The Village App/village-app/.worktrees/log-editing"
pnpm --filter mobile add -D vitest@^2.1.9
```

- [ ] **Step 2: Create the config**

Scoped deliberately to `src/utils` — these are the only files with no React Native imports, so no transform pipeline is needed. Widening this include glob will pull in RN modules that vitest cannot parse.

Create `apps/mobile/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/utils/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add the test scripts**

In `apps/mobile/package.json`, add to `"scripts"` (alongside the existing `type-check` and `lint`):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify the runner starts**

Run: `pnpm --filter mobile test`
Expected: exits 0 with "No test files found" — the runner works, there is nothing to run yet.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/vitest.config.ts apps/mobile/package.json pnpm-lock.yaml
git commit -m "test: add vitest scoped to pure-logic utils"
```

---

## Task 1: Pure logic module (`logEntry.ts`)

Everything correctness-critical lives here so it can be tested without a simulator.

**Files:**
- Create: `apps/mobile/src/utils/logEntry.ts`
- Test: `apps/mobile/src/utils/logEntry.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/utils/logEntry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  validateInterval, validateFeedShape, isRunaway,
  dayKeyLocal, groupByDay, minutesAgoISO, clampOz,
} from './logEntry';

const NOW = Date.parse('2026-08-13T15:00:00.000Z');

describe('validateInterval', () => {
  it('accepts a start before an end', () => {
    expect(validateInterval('2026-08-13T10:00:00Z', '2026-08-13T11:00:00Z', NOW).ok).toBe(true);
  });
  it('accepts a null end (session still running)', () => {
    expect(validateInterval('2026-08-13T10:00:00Z', null, NOW).ok).toBe(true);
  });
  it('rejects an end before its start', () => {
    const r = validateInterval('2026-08-13T11:00:00Z', '2026-08-13T10:00:00Z', NOW);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/end/i);
  });
  it('rejects a start in the future', () => {
    expect(validateInterval('2026-08-13T16:00:00Z', null, NOW).ok).toBe(false);
  });
  it('rejects an end in the future', () => {
    expect(validateInterval('2026-08-13T10:00:00Z', '2026-08-13T16:00:00Z', NOW).ok).toBe(false);
  });
  it('rejects an unparseable timestamp', () => {
    expect(validateInterval('not-a-date', null, NOW).ok).toBe(false);
  });
});

describe('validateFeedShape', () => {
  it('accepts breast with a side and no oz', () => {
    expect(validateFeedShape('breast', 'left', null).ok).toBe(true);
  });
  it('accepts bottle with oz and no side', () => {
    expect(validateFeedShape('bottle', null, 4).ok).toBe(true);
  });
  it('rejects breast without a side', () => {
    expect(validateFeedShape('breast', null, null).ok).toBe(false);
  });
  it('rejects bottle carrying a side', () => {
    expect(validateFeedShape('bottle', 'left', 4).ok).toBe(false);
  });
  it('rejects breast carrying oz', () => {
    expect(validateFeedShape('breast', 'left', 4).ok).toBe(false);
  });
  it('rejects oz above the ceiling', () => {
    expect(validateFeedShape('bottle', null, 99).ok).toBe(false);
  });
  it('rejects negative oz', () => {
    expect(validateFeedShape('bottle', null, -1).ok).toBe(false);
  });
});

describe('isRunaway', () => {
  it('flags a sleep session past 12h', () => {
    expect(isRunaway('sleep', new Date(NOW - 13 * 3600_000).toISOString(), NOW)).toBe(true);
  });
  it('leaves a legitimate 8h overnight sleep alone', () => {
    expect(isRunaway('sleep', new Date(NOW - 8 * 3600_000).toISOString(), NOW)).toBe(false);
  });
  it('flags a feed past 2h', () => {
    expect(isRunaway('feed', new Date(NOW - 3 * 3600_000).toISOString(), NOW)).toBe(true);
  });
  it('leaves a 40m feed alone', () => {
    expect(isRunaway('feed', new Date(NOW - 40 * 60_000).toISOString(), NOW)).toBe(false);
  });
});

describe('dayKeyLocal', () => {
  it('uses the local calendar day, not UTC', () => {
    // 2026-08-13T01:00:00Z is still Aug 12 in any Americas timezone.
    const d = new Date('2026-08-13T01:00:00Z');
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(dayKeyLocal('2026-08-13T01:00:00Z')).toBe(expected);
  });
});

describe('groupByDay', () => {
  it('groups by local day, newest day first, and preserves item order', () => {
    const items = [
      { id: 'a', at: '2026-08-13T18:00:00Z' },
      { id: 'b', at: '2026-08-13T19:00:00Z' },
      { id: 'c', at: '2026-08-11T18:00:00Z' },
    ];
    const groups = groupByDay(items, (i) => i.at);
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['c']);
    expect(groups[0].dayKey > groups[1].dayKey).toBe(true);
  });
  it('returns an empty array for no items', () => {
    expect(groupByDay([], (i: { at: string }) => i.at)).toEqual([]);
  });
});

describe('minutesAgoISO', () => {
  it('subtracts the minutes from now', () => {
    expect(minutesAgoISO(30, NOW)).toBe(new Date(NOW - 30 * 60_000).toISOString());
  });
  it('returns now for zero', () => {
    expect(minutesAgoISO(0, NOW)).toBe(new Date(NOW).toISOString());
  });
});

describe('clampOz', () => {
  it('rounds to the nearest half ounce', () => {
    expect(clampOz(3.3)).toBe(3.5);
    expect(clampOz(3.1)).toBe(3);
  });
  it('clamps to the ceiling and floor', () => {
    expect(clampOz(99)).toBe(12);
    expect(clampOz(-4)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter mobile test`
Expected: FAIL — `Failed to resolve import "./logEntry"`.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/utils/logEntry.ts`:

```ts
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
  if (start > nowMs) return { ok: false, reason: "That start time is in the future." };
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
    if (amountOz != null) return { ok: false, reason: "Ounces only apply to a bottle." };
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter mobile test`
Expected: PASS — 23 tests across 7 describe blocks.

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm --filter mobile type-check
git add apps/mobile/src/utils/logEntry.ts apps/mobile/src/utils/logEntry.test.ts
git commit -m "feat(tracker): pure validation, time math, and local-day grouping

dayKeyLocal replaces the UTC iso.slice(0,10) grouping — an evening feed in a
US timezone was counting as the next day, inflating the distinct-day count and
deflating feedsPerDay in Insights."
```

---

## Task 2: API layer — read, update, delete

**Files:**
- Modify: `apps/mobile/src/api/babyTracker.ts`

- [ ] **Step 1: Add the entry types and swap in the local day key**

At the top of `apps/mobile/src/api/babyTracker.ts`, add to the imports:

```ts
import {
  validateInterval, validateFeedShape, dayKeyLocal, clampOz,
  type LogKind,
} from '@utils/logEntry';
```

Delete the local UTC helper on line 60 (`const dayKey = (iso: string): string => iso.slice(0, 10);`) and replace every `dayKey(` call in `getRecentStats` with `dayKeyLocal(`. There are two: `feedDays` and `diaperDays`.

Then add the shared types after the existing `ParseResult` interface:

```ts
export type { LogKind };

export type LogEntry =
  | { kind: 'sleep';  row: SleepLog }
  | { kind: 'feed';   row: FeedLog }
  | { kind: 'diaper'; row: DiaperLog }
  | { kind: 'note';   row: NoteLog };

/**
 * Edit and delete report failure, unlike logging.
 *
 * Logging fails soft on purpose so the UI degrades if a migration hasn't
 * landed. Edit and delete must not inherit that: a delete that silently
 * no-ops is worse than no delete button at all.
 */
export interface MutationResult { ok: boolean; reason?: string }

const TABLE: Record<LogKind, string> = {
  sleep: 'baby_sleep_logs',
  feed: 'baby_feed_logs',
  diaper: 'baby_diaper_logs',
  note: 'baby_log_notes',
};

// Postgres unique-violation. Our two partial indexes (uniq_baby_sleep_active,
// uniq_baby_feed_active) permit exactly one open session per user, so an edit
// that reopens a closed session collides with a running one.
const PG_UNIQUE_VIOLATION = '23505';

function mutationError(op: string, error: { message: string; code?: string }): MutationResult {
  console.warn(`[tracker] ${op}`, error.message);
  if (error.code === PG_UNIQUE_VIOLATION) {
    return { ok: false, reason: 'Another session is already running. Stop that one first.' };
  }
  return { ok: false, reason: "That didn't save. Check your connection and try again." };
}
```

- [ ] **Step 2: Add the update methods**

Insert into the `babyTrackerApi` object, after `stopSleep`:

```ts
  async updateSleep(
    id: string, patch: { started_at?: string; ended_at?: string | null },
  ): Promise<MutationResult> {
    const current = await supabase
      .from('baby_sleep_logs').select('started_at, ended_at').eq('id', id).maybeSingle();
    if (current.error || !current.data) return { ok: false, reason: "Couldn't find that nap." };
    const started = patch.started_at ?? (current.data.started_at as string);
    const ended = 'ended_at' in patch ? patch.ended_at! : (current.data.ended_at as string | null);
    const v = validateInterval(started, ended, Date.now());
    if (!v.ok) return v;
    const { error } = await supabase.from('baby_sleep_logs').update(patch).eq('id', id);
    return error ? mutationError('updateSleep', error) : { ok: true };
  },

  async updateFeed(
    id: string,
    patch: {
      method?: FeedMethod; side?: BreastSide | null;
      started_at?: string; ended_at?: string | null; amount_oz?: number | null;
    },
  ): Promise<MutationResult> {
    const current = await supabase
      .from('baby_feed_logs')
      .select('method, side, started_at, ended_at, amount_oz').eq('id', id).maybeSingle();
    if (current.error || !current.data) return { ok: false, reason: "Couldn't find that feed." };
    const c = current.data as FeedLog;
    const method = patch.method ?? c.method;
    // `in` rather than `!= null` — this is what lets an edit CLEAR a value.
    const side = 'side' in patch ? patch.side! : c.side;
    const started = patch.started_at ?? c.started_at;
    const ended = 'ended_at' in patch ? patch.ended_at! : c.ended_at;
    const oz = 'amount_oz' in patch
      ? (patch.amount_oz == null ? null : clampOz(patch.amount_oz))
      : c.amount_oz;

    const shape = validateFeedShape(method, method === 'bottle' ? null : side, method === 'breast' ? null : oz);
    if (!shape.ok) return shape;
    const interval = validateInterval(started, ended, Date.now());
    if (!interval.ok) return interval;

    // Normalise so a method switch can never leave an orphan side or oz behind.
    const normalised = {
      ...patch,
      method,
      side: method === 'bottle' ? null : side,
      amount_oz: method === 'breast' ? null : oz,
    };
    const { error } = await supabase.from('baby_feed_logs').update(normalised).eq('id', id);
    return error ? mutationError('updateFeed', error) : { ok: true };
  },

  async updateDiaper(
    id: string, patch: { kind?: DiaperKind; occurred_at?: string },
  ): Promise<MutationResult> {
    if (patch.occurred_at) {
      const v = validateInterval(patch.occurred_at, null, Date.now());
      if (!v.ok) return v;
    }
    const { error } = await supabase.from('baby_diaper_logs').update(patch).eq('id', id);
    return error ? mutationError('updateDiaper', error) : { ok: true };
  },

  async updateNote(
    id: string, patch: { raw_text?: string; occurred_at?: string },
  ): Promise<MutationResult> {
    if (patch.raw_text != null && !patch.raw_text.trim()) {
      return { ok: false, reason: "A note can't be empty. Delete it instead." };
    }
    if (patch.occurred_at) {
      const v = validateInterval(patch.occurred_at, null, Date.now());
      if (!v.ok) return v;
    }
    const { error } = await supabase.from('baby_log_notes').update(patch).eq('id', id);
    return error ? mutationError('updateNote', error) : { ok: true };
  },

  async deleteEntry(kind: LogKind, id: string): Promise<MutationResult> {
    const { error } = await supabase.from(TABLE[kind]).delete().eq('id', id);
    return error ? mutationError('deleteEntry', error) : { ok: true };
  },
```

- [ ] **Step 3: Fix the `stopFeed` ounce bug**

`stopFeed` currently guards with `if (amountOz != null)`, which makes ounces impossible to clear once set. Replace the whole method (currently lines 144–150):

```ts
  // `amountOz === undefined` leaves ounces untouched; `null` clears them.
  async stopFeed(id: string, endedAt?: string, amountOz?: number | null): Promise<boolean> {
    const patch: Record<string, unknown> = { ended_at: endedAt ?? new Date().toISOString() };
    if (amountOz !== undefined) patch.amount_oz = amountOz == null ? null : clampOz(amountOz);
    const { error } = await supabase.from('baby_feed_logs').update(patch).eq('id', id);
    if (error) { console.warn('[tracker] stopFeed', error.message); return false; }
    return true;
  },
```

- [ ] **Step 4: Generalise the day read and bound the open-session window**

Replace `getToday` (currently lines 208–231) with:

```ts
  // Open sessions older than this stop counting as "today" — a nap nobody
  // stopped three days ago is a data-quality problem for the rescue prompt to
  // handle, not a row that should sit at the top of today's timeline forever.
  async getDay(dayStart: Date = startOfToday()): Promise<TodayLogs> {
    const from = dayStart.toISOString();
    const to = new Date(dayStart.getTime() + 86400000).toISOString();
    const openSince = new Date(Date.now() - 86400000).toISOString();
    const empty: TodayLogs = { sleep: [], feeds: [], diapers: [], notes: [] };

    const openClause = `and(ended_at.is.null,started_at.gte.${openSince})`;
    const [sleep, feeds, diapers, notes] = await Promise.all([
      supabase.from('baby_sleep_logs').select('id, started_at, ended_at, source')
        .or(`and(started_at.gte.${from},started_at.lt.${to}),${openClause}`)
        .order('started_at', { ascending: false }),
      supabase.from('baby_feed_logs').select('id, method, side, started_at, ended_at, amount_oz, source')
        .or(`and(started_at.gte.${from},started_at.lt.${to}),${openClause}`)
        .order('started_at', { ascending: false }),
      supabase.from('baby_diaper_logs').select('id, kind, occurred_at, source')
        .gte('occurred_at', from).lt('occurred_at', to).order('occurred_at', { ascending: false }),
      supabase.from('baby_log_notes').select('id, raw_text, occurred_at')
        .gte('occurred_at', from).lt('occurred_at', to).order('occurred_at', { ascending: false }),
    ]);
    if (sleep.error || feeds.error || diapers.error || notes.error) {
      console.warn('[tracker] getDay', sleep.error?.message || feeds.error?.message || diapers.error?.message || notes.error?.message);
    }
    return {
      sleep: (sleep.data as SleepLog[]) ?? empty.sleep,
      feeds: (feeds.data as FeedLog[]) ?? empty.feeds,
      diapers: (diapers.data as DiaperLog[]) ?? empty.diapers,
      notes: (notes.data as NoteLog[]) ?? empty.notes,
    };
  },

  async getToday(): Promise<TodayLogs> {
    return babyTrackerApi.getDay();
  },

  // History paging — a window of whole days, newest first.
  async getRange(fromISO: string, toISO: string): Promise<TodayLogs> {
    const empty: TodayLogs = { sleep: [], feeds: [], diapers: [], notes: [] };
    const [sleep, feeds, diapers, notes] = await Promise.all([
      supabase.from('baby_sleep_logs').select('id, started_at, ended_at, source')
        .gte('started_at', fromISO).lt('started_at', toISO).order('started_at', { ascending: false }),
      supabase.from('baby_feed_logs').select('id, method, side, started_at, ended_at, amount_oz, source')
        .gte('started_at', fromISO).lt('started_at', toISO).order('started_at', { ascending: false }),
      supabase.from('baby_diaper_logs').select('id, kind, occurred_at, source')
        .gte('occurred_at', fromISO).lt('occurred_at', toISO).order('occurred_at', { ascending: false }),
      supabase.from('baby_log_notes').select('id, raw_text, occurred_at')
        .gte('occurred_at', fromISO).lt('occurred_at', toISO).order('occurred_at', { ascending: false }),
    ]);
    if (sleep.error || feeds.error || diapers.error || notes.error) {
      console.warn('[tracker] getRange', sleep.error?.message || feeds.error?.message);
    }
    return {
      sleep: (sleep.data as SleepLog[]) ?? empty.sleep,
      feeds: (feeds.data as FeedLog[]) ?? empty.feeds,
      diapers: (diapers.data as DiaperLog[]) ?? empty.diapers,
      notes: (notes.data as NoteLog[]) ?? empty.notes,
    };
  },

  // Every open session regardless of age — the rescue prompt's input.
  async getOpenSessions(): Promise<{ sleep: SleepLog | null; feed: FeedLog | null }> {
    const [s, f] = await Promise.all([
      babyTrackerApi.getActiveSleep(),
      babyTrackerApi.getActiveFeed(),
    ]);
    return { sleep: s, feed: f };
  },
```

Then replace the existing `startOfTodayISO` helper (lines 72–76) with a `Date`-returning version, since `getDay` needs the object:

```ts
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
```

- [ ] **Step 5: Typecheck, lint, commit**

Run: `pnpm --filter mobile type-check && pnpm --filter mobile lint`
Expected: both clean.

```bash
git add apps/mobile/src/api/babyTracker.ts
git commit -m "feat(tracker): editable logs at the API layer

Adds update/delete for all four log types, getDay/getRange/getOpenSessions,
and surfaces failure instead of failing soft — a silent no-op delete is worse
than no delete button. Also bounds today's open-session window to 24h so a
forgotten nap stops living at the top of today forever."
```

---

## Task 3: Store — mutations and optional timestamps

**Files:**
- Modify: `apps/mobile/src/store/babyTracker.ts`

- [ ] **Step 1: Extend the interface**

In `apps/mobile/src/store/babyTracker.ts`, update the imports and the `TrackerState` interface:

```ts
import {
  babyTrackerApi, type TodayLogs, type SleepLog, type FeedLog,
  type FeedMethod, type BreastSide, type DiaperKind, type ParseResult,
  type LogEntry, type MutationResult,
} from '@api/babyTracker';
```

```ts
interface TrackerState {
  babyProfileId: string | null;
  activeSleep: SleepLog | null;
  activeFeed: FeedLog | null;
  today: TodayLogs;
  loading: boolean;

  refresh: (babyProfileId: string) => Promise<void>;
  // `at` back-dates the entry; omitted means now.
  startSleep: (at?: string) => Promise<void>;
  stopSleep: (at?: string) => Promise<void>;
  startFeed: (method: FeedMethod, side: BreastSide | null, at?: string) => Promise<void>;
  stopFeed: (amountOz?: number | null, at?: string) => Promise<void>;
  logBottle: (amountOz: number, at?: string) => Promise<void>;
  logDiaper: (kind: DiaperKind, at?: string) => Promise<void>;
  logNote: (text: string) => Promise<void>;
  parseNote: (text: string) => Promise<ParseResult | null>;

  updateEntry: (entry: LogEntry, patch: Record<string, unknown>) => Promise<MutationResult>;
  deleteEntry: (entry: LogEntry) => Promise<MutationResult>;
}
```

- [ ] **Step 2: Thread the timestamps through the existing actions**

Replace the five logging actions with timestamp-aware versions:

```ts
  startSleep: async (at) => {
    const { babyProfileId, activeSleep } = get();
    if (!babyProfileId || activeSleep) return;
    const row = await babyTrackerApi.startSleep(babyProfileId, at);
    if (row) set({ activeSleep: row });
    get().refresh(babyProfileId);
  },

  stopSleep: async (at) => {
    const { babyProfileId, activeSleep } = get();
    if (!activeSleep) return;
    await babyTrackerApi.stopSleep(activeSleep.id, at);
    set({ activeSleep: null });
    if (babyProfileId) get().refresh(babyProfileId);
  },

  startFeed: async (method, side, at) => {
    const { babyProfileId, activeFeed } = get();
    if (!babyProfileId || activeFeed) return;
    const row = await babyTrackerApi.startFeed(babyProfileId, method, side, at);
    if (row) set({ activeFeed: row });
    get().refresh(babyProfileId);
  },

  stopFeed: async (amountOz, at) => {
    const { babyProfileId, activeFeed } = get();
    if (!activeFeed) return;
    await babyTrackerApi.stopFeed(activeFeed.id, at, amountOz);
    set({ activeFeed: null });
    if (babyProfileId) get().refresh(babyProfileId);
  },

  logBottle: async (amountOz, at) => {
    const { babyProfileId } = get();
    if (!babyProfileId) return;
    await babyTrackerApi.logBottle(babyProfileId, amountOz, at);
    get().refresh(babyProfileId);
  },

  logDiaper: async (kind, at) => {
    const { babyProfileId } = get();
    if (!babyProfileId) return;
    await babyTrackerApi.logDiaper(babyProfileId, kind, at);
    get().refresh(babyProfileId);
  },
```

- [ ] **Step 3: Add the mutation actions**

Append inside the store object, after `parseNote`:

```ts
  updateEntry: async (entry, patch) => {
    const { babyProfileId } = get();
    let res: MutationResult;
    switch (entry.kind) {
      case 'sleep':  res = await babyTrackerApi.updateSleep(entry.row.id, patch); break;
      case 'feed':   res = await babyTrackerApi.updateFeed(entry.row.id, patch); break;
      case 'diaper': res = await babyTrackerApi.updateDiaper(entry.row.id, patch); break;
      case 'note':   res = await babyTrackerApi.updateNote(entry.row.id, patch); break;
    }
    if (res.ok && babyProfileId) await get().refresh(babyProfileId);
    return res;
  },

  deleteEntry: async (entry) => {
    const { babyProfileId } = get();
    const res = await babyTrackerApi.deleteEntry(entry.kind, entry.row.id);
    if (res.ok && babyProfileId) await get().refresh(babyProfileId);
    return res;
  },
```

- [ ] **Step 4: Typecheck, lint, commit**

Run: `pnpm --filter mobile type-check && pnpm --filter mobile lint`
Expected: both clean. `PlaybookTracker`'s existing call sites still compile — every new argument is optional.

```bash
git add apps/mobile/src/store/babyTracker.ts
git commit -m "feat(tracker): store mutations and back-datable log actions"
```

---

## Task 4: Month-long seed harness

Run this before building any UI. Every screen after this point is developed against a real month of messy data instead of three hand-made rows.

**Files:**
- Create: `scripts/seed-baby-logs.mjs`
- Modify: `package.json` (root)

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-baby-logs.mjs`:

```js
#!/usr/bin/env node
// Month-long baby-log seed harness.
//
// DRY RUN BY DEFAULT. Prints the month it would write and inserts nothing.
// Writing requires --commit. Every inserted row id is appended to the undo file
// as each batch lands, so a crash mid-run still leaves a usable undo.
//
//   node scripts/seed-baby-logs.mjs --email you@example.com
//   node scripts/seed-baby-logs.mjs --email you@example.com --commit
//   node scripts/seed-baby-logs.mjs --unseed
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const COMMIT = flag('commit');
const UNSEED = flag('unseed');
const DAYS = Number(value('days', '30'));
const EMAIL = value('email', null);
const OUT = value('out', 'scratchpad/seeded-log-ids.json');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { persistSession: false } });

const TABLES = {
  sleep: 'baby_sleep_logs',
  feed: 'baby_feed_logs',
  diaper: 'baby_diaper_logs',
  note: 'baby_log_notes',
};

// Mirrors wakeWindowMinutes() in apps/mobile/src/utils/sleepAlarm.ts. Kept in
// sync by hand — this is seed data, not production logic.
const wakeWindow = (week) =>
  week <= 1 ? 60 : week <= 6 ? 75 : week <= 12 ? 90 : week <= 25 ? 120 : 150;

// Deterministic PRNG so a dry run and the committing run produce the same month.
let seed = 20260813;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const jitter = (base, pct) => base * (1 + (rand() - 0.5) * 2 * pct);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];

async function resolveTargets() {
  const { data: users, error: uErr } = await db
    .from('users').select('id, email').eq('email', EMAIL).limit(1);
  if (uErr) throw new Error(`user lookup failed: ${uErr.message}`);
  if (!users?.length) throw new Error(`no user with email ${EMAIL}`);
  const userId = users[0].id;

  const { data: babies, error: bErr } = await db
    .from('baby_profiles').select('id, baby_name, current_week_number')
    .eq('user_id', userId).limit(1);
  if (bErr) throw new Error(`baby lookup failed: ${bErr.message}`);
  if (!babies?.length) throw new Error(`user ${EMAIL} has no baby profile — create one in the app first`);
  return { userId, baby: babies[0] };
}

/** Build the month in memory. Returns { rows: {kind, payload}[], cases: string[] }. */
function generate(userId, babyProfileId, startWeek) {
  const rows = [];
  const cases = [];
  const push = (kind, payload) => rows.push({ kind, payload: { user_id: userId, baby_profile_id: babyProfileId, ...payload } });

  const midnightToday = new Date();
  midnightToday.setHours(0, 0, 0, 0);
  const EMPTY_DAY_OFFSET = 11;  // failure case 7

  for (let d = DAYS; d >= 1; d--) {
    if (d === EMPTY_DAY_OFFSET) continue;

    const dayStart = new Date(midnightToday.getTime() - d * 86400000);
    const week = startWeek + Math.floor((DAYS - d) / 7);
    const ww = wakeWindow(week);
    const at = (h, m = 0) => new Date(dayStart.getTime() + h * 3600000 + m * 60000).toISOString();

    // Naps: consolidate as the baby ages — more, shorter early; fewer, longer later.
    const napCount = week <= 6 ? 5 : week <= 12 ? 4 : 3;
    const napLen = week <= 6 ? 45 : week <= 12 ? 70 : 95;
    let clock = 7 * 60 + Math.floor(jitter(20, 0.8));
    for (let n = 0; n < napCount; n++) {
      const len = Math.max(20, Math.round(jitter(napLen, 0.35)));
      const s = new Date(dayStart.getTime() + clock * 60000);
      push('sleep', {
        started_at: s.toISOString(),
        ended_at: new Date(s.getTime() + len * 60000).toISOString(),
        source: 'manual',
      });
      clock += len + Math.round(jitter(ww, 0.25));
    }
    // Overnight sleep, tapering wake-ups as the month goes on.
    const nightWakes = week <= 6 ? 2 : week <= 12 ? 1 : 0;
    let nightClock = 20 * 60 + Math.floor(jitter(30, 0.6));
    for (let n = 0; n <= nightWakes; n++) {
      const len = Math.round(jitter(nightWakes ? 180 : 400, 0.2));
      const s = new Date(dayStart.getTime() + nightClock * 60000);
      push('sleep', {
        started_at: s.toISOString(),
        ended_at: new Date(s.getTime() + len * 60000).toISOString(),
        source: 'manual',
      });
      nightClock += len + Math.round(jitter(30, 0.5));
    }

    // Feeds, with an evening cluster block.
    const feedHours = [7, 10, 13, 16, 18, 19, 20, 23, 3];
    for (const h of feedHours) {
      const bottle = rand() < 0.3;
      const s = at(h, Math.floor(rand() * 40));
      const len = Math.round(jitter(bottle ? 12 : 18, 0.4));
      push('feed', {
        method: bottle ? 'bottle' : 'breast',
        side: bottle ? null : pick(['left', 'right']),
        started_at: s,
        ended_at: new Date(Date.parse(s) + len * 60000).toISOString(),
        amount_oz: bottle ? Math.round(jitter(3.5, 0.4) * 2) / 2 : null,
        source: 'manual',
      });
    }

    // 6-10 diapers.
    const diaperCount = 6 + Math.floor(rand() * 5);
    for (let i = 0; i < diaperCount; i++) {
      push('diaper', {
        kind: pick(['wet', 'wet', 'wet', 'dirty', 'both']),
        occurred_at: at(6 + Math.floor(rand() * 17), Math.floor(rand() * 60)),
        source: 'manual',
      });
    }

    // An occasional jot.
    if (rand() < 0.25) {
      push('note', {
        raw_text: pick([
          'fussy all afternoon, maybe a growth spurt',
          'slept through the 3am feed for once',
          'so many smiles today',
          'spit up more than usual after the 4pm bottle',
        ]),
        occurred_at: at(21, Math.floor(rand() * 50)),
      });
    }
  }

  // ── Deliberate failure cases — the point of the exercise ────────────────
  const now = Date.now();

  cases.push('1. sleep session left open 26h ago (above the 12h ceiling — escalated rescue prompt)');
  push('sleep', { started_at: new Date(now - 26 * 3600000).toISOString(), ended_at: null, source: 'manual' });

  cases.push('2. a 5h nap that was closed but is implausibly long (below the ceiling — always-available "ended at…")');
  push('sleep', {
    started_at: new Date(now - 30 * 3600000).toISOString(),
    ended_at: new Date(now - 25 * 3600000).toISOString(), source: 'manual',
  });

  cases.push('3. duplicate feed logged twice within a minute');
  const dupStart = new Date(now - 5 * 3600000).toISOString();
  for (let i = 0; i < 2; i++) {
    push('feed', {
      method: 'breast', side: 'left', started_at: dupStart,
      ended_at: new Date(Date.parse(dupStart) + 15 * 60000).toISOString(),
      amount_oz: null, source: 'manual',
    });
  }

  cases.push('4. breast feed recorded on the wrong side');
  push('feed', {
    method: 'breast', side: 'right',
    started_at: new Date(now - 9 * 3600000).toISOString(),
    ended_at: new Date(now - 9 * 3600000 + 20 * 60000).toISOString(),
    amount_oz: null, source: 'manual',
  });

  cases.push('5. note whose parsed rows landed on the wrong half of the day (mis-heard "3")');
  push('note', { raw_text: 'fed her at 3 and she went down after', occurred_at: new Date(now - 12 * 3600000).toISOString() });
  push('feed', {
    method: 'breast', side: 'left',
    started_at: new Date(now - 12 * 3600000).toISOString(),
    ended_at: new Date(now - 12 * 3600000 + 18 * 60000).toISOString(),
    amount_oz: null, source: 'note',
  });

  cases.push('6. bottle with a nonsense ounce value');
  push('feed', {
    method: 'bottle', side: null,
    started_at: new Date(now - 7 * 3600000).toISOString(),
    ended_at: new Date(now - 7 * 3600000 + 10 * 60000).toISOString(),
    amount_oz: 11.5, source: 'manual',
  });

  cases.push(`7. a day with no logs at all (${EMPTY_DAY_OFFSET} days ago)`);

  return { rows, cases };
}

function report(rows, cases, baby) {
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {});
  console.log(`\nBaby: ${baby.baby_name ?? '(unnamed)'} · currently week ${baby.current_week_number}`);
  console.log(`Window: ${DAYS} days ending yesterday\n`);
  console.log('Rows that would be written:');
  for (const [kind, n] of Object.entries(counts)) console.log(`  ${kind.padEnd(7)} ${n}`);
  console.log(`  ${'TOTAL'.padEnd(7)} ${rows.length}\n`);

  const sampleDay = rows
    .filter((r) => r.payload.started_at?.startsWith(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10))
      || r.payload.occurred_at?.startsWith(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)))
    .slice(0, 12);
  console.log('Sample day (3 days ago, first 12 entries):');
  for (const r of sampleDay) {
    const ts = r.payload.started_at ?? r.payload.occurred_at;
    console.log(`  ${ts}  ${r.kind}`);
  }

  console.log('\nDeliberate failure cases:');
  for (const c of cases) console.log(`  ${c}`);
}

function appendIds(kind, ids) {
  mkdirSync(dirname(OUT), { recursive: true });
  const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  existing[kind] = [...(existing[kind] ?? []), ...ids];
  writeFileSync(OUT, JSON.stringify(existing, null, 2));
}

async function commit(rows) {
  const byKind = rows.reduce((acc, r) => {
    (acc[r.kind] ??= []).push(r.payload);
    return acc;
  }, {});
  for (const [kind, payloads] of Object.entries(byKind)) {
    for (let i = 0; i < payloads.length; i += 200) {
      const batch = payloads.slice(i, i + 200);
      const { data, error } = await db.from(TABLES[kind]).insert(batch).select('id');
      if (error) {
        console.error(`\nINSERT FAILED on ${kind}: ${error.message}`);
        console.error(`Rows written so far are recorded in ${OUT} — run --unseed to remove them.`);
        process.exit(1);
      }
      // Record ids BEFORE moving on, so a crash still leaves a usable undo.
      appendIds(kind, data.map((r) => r.id));
      process.stdout.write(`  ${kind}: ${Math.min(i + 200, payloads.length)}/${payloads.length}\r`);
    }
    console.log(`  ${kind}: ${payloads.length}/${payloads.length} written`);
  }
}

async function unseed() {
  if (!existsSync(OUT)) { console.error(`No undo file at ${OUT}.`); process.exit(1); }
  const ids = JSON.parse(readFileSync(OUT, 'utf8'));
  for (const [kind, list] of Object.entries(ids)) {
    if (!list.length) continue;
    for (let i = 0; i < list.length; i += 200) {
      const { error } = await db.from(TABLES[kind]).delete().in('id', list.slice(i, i + 200));
      if (error) { console.error(`delete failed on ${kind}: ${error.message}`); process.exit(1); }
    }
    console.log(`  ${kind}: ${list.length} deleted`);
  }
  writeFileSync(OUT, JSON.stringify({}, null, 2));
  console.log('\nUnseeded. Undo file cleared.');
}

async function main() {
  if (UNSEED) return unseed();
  if (!EMAIL) { console.error('Pass --email <address>.'); process.exit(1); }

  const { userId, baby } = await resolveTargets();
  const startWeek = Math.max(1, (baby.current_week_number ?? 4) - Math.floor(DAYS / 7));
  const { rows, cases } = generate(userId, baby.id, startWeek);
  report(rows, cases, baby);

  if (!COMMIT) {
    console.log('\nDRY RUN — nothing was written. Re-run with --commit to insert.\n');
    return;
  }
  if (existsSync(OUT) && Object.keys(JSON.parse(readFileSync(OUT, 'utf8'))).length) {
    console.error(`\n${OUT} still holds ids from a previous run. Run --unseed first.`);
    process.exit(1);
  }
  console.log('\nWriting…');
  await commit(rows);
  console.log(`\nDone. Undo with: node scripts/seed-baby-logs.mjs --unseed\n`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Add the root package scripts**

In the root `package.json`, add to `"scripts"`:

```json
"logs:seed": "node scripts/seed-baby-logs.mjs",
"logs:unseed": "node scripts/seed-baby-logs.mjs --unseed"
```

- [ ] **Step 3: Run the dry run**

```bash
cd "/Users/gp/The Village App/village-app/.worktrees/log-editing"
export SUPABASE_URL="$(grep EXPO_PUBLIC_SUPABASE_URL apps/mobile/.env | cut -d= -f2)"
export SUPABASE_SERVICE_ROLE_KEY="<from Supabase dashboard → Project Settings → API>"
pnpm logs:seed -- --email fele_trujillo@hotmail.com
```

Expected: a per-type row count (roughly 250 sleep, 270 feed, 230 diaper, 8 note), a sample day, and the seven failure cases listed. **Nothing written.**

- [ ] **Step 4: Commit the harness, then write the data**

```bash
git add scripts/seed-baby-logs.mjs package.json
git commit -m "feat(tracker): month-long seed harness, dry-run by default

Generates an evolving month (wake windows stretching, naps consolidating,
evening cluster feeds, night wakings tapering) plus seven deliberate failure
cases. Records every inserted row id per batch so the undo survives a crash."
```

```bash
pnpm logs:seed -- --email fele_trujillo@hotmail.com --commit
```

Expected: per-type progress, then a `scratchpad/seeded-log-ids.json` holding every id.

- [ ] **Step 5: Verify in the app**

Open the app, go to Insights. The week stepper should now walk back through four real weeks. Note what looks wrong — that list is the acceptance criteria for the rest of the plan.

---

## Task 5: Extract `LogTimeline`

**Files:**
- Create: `apps/mobile/src/components/tracker/LogTimeline.tsx`
- Modify: `apps/mobile/src/components/manual/PlaybookTracker.tsx`

- [ ] **Step 1: Create the component**

This is a move, not a rewrite: `buildTimeline`, the `Entry` type, `feedShort`, `clockLabel`, and the row markup all come out of `PlaybookTracker.tsx` unchanged except for becoming touchable and carrying the source `LogEntry`.

Create `apps/mobile/src/components/tracker/LogTimeline.tsx`:

```tsx
// Merged log timeline — sleep, feeds, diapers, and notes on one time axis.
// Extracted from PlaybookTracker so LogHistoryScreen renders identical rows.
// Rows are touchable: tapping one hands the underlying LogEntry back so the
// caller can open the edit sheet.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, FONTS } from '@utils/constants';
import type { TodayLogs, LogEntry, FeedLog } from '@api/babyTracker';

const C = {
  paper: COLORS.v2_paper, cocoa: COLORS.v2_cocoa, walnut: COLORS.v2_walnut,
  rose: COLORS.v2_cinnamon,
  honeyBg: '#F7E7BE', honeyInk: '#5A4012',
  oliveBg: '#E4E7C8', oliveInk: '#3F4516',
};

export const TL_ICON = {
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  droplet: 'M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z',
  bottle: 'M9 2h6M10 2v3l-2 3v11a2 2 0 002 2h4a2 2 0 002-2V8l-2-3V2M8 12h8',
  note: 'M5 4h14v16l-4-3H5z',
} as const;

function Glyph({ d, color, size = 12, sw = 1.7 }: { d: string; color: string; size?: number; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function clockLabel(iso: string, lang: 'en' | 'es'): string {
  const d = new Date(iso);
  const h = d.getHours(); const m = d.getMinutes();
  const mm = m < 10 ? `0${m}` : `${m}`;
  if (lang === 'es') return `${h}:${mm}`;
  const ap = h < 12 ? 'a' : 'p'; let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${mm}${ap}`;
}

export function feedShort(f: FeedLog, es: boolean): string {
  if (f.method === 'bottle') return `${es ? 'biberón' : 'bottle'}${f.amount_oz ? ` ${f.amount_oz}oz` : ''}`;
  return f.side === 'left' ? (es ? 'izq.' : 'left') : (es ? 'der.' : 'right');
}

export interface TimelineItem {
  id: string; iso: string; label: string;
  tint: string; ink: string; icon: string; entry: LogEntry;
}

export function buildTimeline(logs: TodayLogs, es: boolean): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const s of logs.sleep) {
    const mins = s.ended_at ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000) : null;
    out.push({
      id: `s${s.id}`, iso: s.started_at, tint: '#F0D7C3', ink: '#9A4E28', icon: TL_ICON.moon,
      label: mins != null ? `${es ? 'Siesta' : 'Nap'} · ${mins} min` : `${es ? 'Siesta — en curso' : 'Nap — in progress'}`,
      entry: { kind: 'sleep', row: s },
    });
  }
  for (const f of logs.feeds) {
    const mins = f.ended_at ? Math.round((new Date(f.ended_at).getTime() - new Date(f.started_at).getTime()) / 60000) : null;
    const label = f.method === 'bottle'
      ? `${es ? 'Biberón' : 'Bottle'}${f.amount_oz ? ` · ${f.amount_oz} oz` : ''}`
      : `${f.side === 'left' ? (es ? 'Pecho izq.' : 'Left breast') : (es ? 'Pecho der.' : 'Right breast')}${mins != null ? ` · ${mins} min` : (es ? ' — en curso' : ' — in progress')}`;
    out.push({ id: `f${f.id}`, iso: f.started_at, tint: C.honeyBg, ink: C.honeyInk, icon: TL_ICON.bottle, label, entry: { kind: 'feed', row: f } });
  }
  for (const d of logs.diapers) {
    out.push({
      id: `d${d.id}`, iso: d.occurred_at, tint: C.oliveBg, ink: C.oliveInk, icon: TL_ICON.droplet,
      label: es
        ? { wet: 'Pañal mojado', dirty: 'Pañal sucio', both: 'Pañal ambos' }[d.kind]
        : { wet: 'Wet diaper', dirty: 'Dirty diaper', both: 'Wet + dirty' }[d.kind],
      entry: { kind: 'diaper', row: d },
    });
  }
  for (const n of logs.notes) {
    out.push({ id: `n${n.id}`, iso: n.occurred_at, tint: '#FBEFD9', ink: C.rose, icon: TL_ICON.note, label: n.raw_text, entry: { kind: 'note', row: n } });
  }
  return out.sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime());
}

export default function LogTimeline({ items, lang, onPressItem }: {
  items: TimelineItem[]; lang: 'en' | 'es'; onPressItem: (entry: LogEntry) => void;
}) {
  const es = lang === 'es';
  return (
    <View>
      {items.map((e, i) => (
        <TouchableOpacity
          key={e.id}
          onPress={() => onPressItem(e.entry)}
          activeOpacity={0.6}
          style={[styles.row, i < items.length - 1 && styles.divider]}
          accessibilityRole="button"
          accessibilityLabel={`${clockLabel(e.iso, lang)} ${e.label}. ${es ? 'Toca para editar' : 'Tap to edit'}`}
        >
          <Text style={styles.time}>{clockLabel(e.iso, lang)}</Text>
          <View style={[styles.icon, { backgroundColor: e.tint }]}><Glyph d={e.icon} color={e.ink} /></View>
          <Text style={styles.label} numberOfLines={1}>{e.label}</Text>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.1)' },
  time: { fontFamily: FONTS.v2_mono, fontSize: 9.5, color: C.walnut, width: 44 },
  icon: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 12, color: C.cocoa },
  chev: { fontFamily: FONTS.v2_link, fontSize: 15, color: C.walnut, opacity: 0.5 },
});
```

- [ ] **Step 2: Delete the duplicated code from `PlaybookTracker`**

In `apps/mobile/src/components/manual/PlaybookTracker.tsx`:
- Delete the local `buildTimeline`, the `Entry` type, and `feedShort` (lines 382–415).
- Delete the local `clockLabel` (lines 52–59).
- Delete the `tlRow` / `tlDivider` / `tlTime` / `tlIcon` / `tlLabel` styles.
- Add the import:

```tsx
import LogTimeline, { buildTimeline, clockLabel, feedShort } from '@components/tracker/LogTimeline';
```

- Replace the timeline JSX block (lines 359–372) with:

```tsx
      {timeline.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.todayEyebrow}>{es ? 'HOY' : 'TODAY'}</Text>
            <TouchableOpacity
              onPress={() => onSeeAll?.()}
              accessibilityRole="button"
              accessibilityLabel={es ? 'Ver todos los registros' : 'See all logs'}
            >
              <Text style={styles.seeAll}>{es ? 'ver todo ›' : 'see all ›'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 6 }}>
            <LogTimeline items={timeline.slice(0, 8)} lang={lang} onPressItem={setEditing} />
          </View>
        </View>
      )}
```

- Add `onSeeAll?: () => void` to the component's props, and this state near the other `useState` calls:

```tsx
const [editing, setEditing] = useState<LogEntry | null>(null);
```

- Add the `seeAll` style:

```tsx
  seeAll: { fontFamily: FONTS.v2_link, fontSize: 11.5, color: C.rose },
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter mobile type-check && pnpm --filter mobile lint`
Expected: clean. `editing` is set but unused until Task 7 — if lint flags it, wire the sheet in Task 7 rather than suppressing the rule.

- [ ] **Step 4: Verify in the simulator**

Open Insights against the seeded month. The TODAY timeline still renders identically, now with a chevron on each row and a "see all ›" link. Tapping a row does nothing yet.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/tracker/LogTimeline.tsx apps/mobile/src/components/manual/PlaybookTracker.tsx
git commit -m "refactor(tracker): extract LogTimeline so history can reuse the rows"
```

---

## Task 6: Pure-JS time control (`TimeField`)

No native picker — this is what keeps the whole feature OTA-able. Modeled on the ± hour stepper already shipped in `NotificationPreferencesScreen`.

**Files:**
- Create: `apps/mobile/src/components/tracker/TimeField.tsx`

- [ ] **Step 1: Create the component**

```tsx
// Pure-JS date + time control.
//
// Deliberately NOT @react-native-community/datetimepicker: that is a native
// module, and adding one would gate this entire feature behind a native build.
// Follows the ± stepper pattern already shipped in NotificationPreferencesScreen.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { select } from '@utils/haptics';

const C = {
  paper: COLORS.v2_paper, parchment: COLORS.v2_parchment,
  cocoa: COLORS.v2_cocoa, walnut: COLORS.v2_walnut, rose: COLORS.v2_cinnamon,
};

function dayLabel(d: Date, lang: 'en' | 'es'): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return lang === 'es' ? 'hoy' : 'today';
  if (diff === 1) return lang === 'es' ? 'ayer' : 'yesterday';
  return d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric' });
}

function timeLabel(d: Date, lang: 'en' | 'es'): string {
  const h = d.getHours(); const mm = String(d.getMinutes()).padStart(2, '0');
  if (lang === 'es') return `${String(h).padStart(2, '0')}:${mm}`;
  const ap = h < 12 ? 'AM' : 'PM'; let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${mm} ${ap}`;
}

export default function TimeField({ label, value, onChange, lang, maxNow = true }: {
  label: string;
  value: string;                       // ISO
  onChange: (iso: string) => void;
  lang: 'en' | 'es';
  maxNow?: boolean;                    // clamp forward stepping to now
}) {
  const d = new Date(value);

  const shift = (deltaMs: number) => {
    select();
    const next = new Date(d.getTime() + deltaMs);
    if (maxNow && next.getTime() > Date.now()) return;
    onChange(next.toISOString());
  };

  const Step = ({ dir, ms, a11y }: { dir: '−' | '+'; ms: number; a11y: string }) => (
    <TouchableOpacity
      onPress={() => shift(dir === '−' ? -ms : ms)}
      style={s.stepBtn}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      <Text style={s.stepTxt}>{dir}</Text>
    </TouchableOpacity>
  );

  const es = lang === 'es';
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        <Step dir="−" ms={86400000} a11y={es ? 'Un día antes' : 'One day earlier'} />
        <Text style={s.day}>{dayLabel(d, lang)}</Text>
        <Step dir="+" ms={86400000} a11y={es ? 'Un día después' : 'One day later'} />
      </View>
      <View style={s.row}>
        <Step dir="−" ms={3600000} a11y={es ? 'Una hora antes' : 'One hour earlier'} />
        <Text style={s.time}>{timeLabel(d, lang)}</Text>
        <Step dir="+" ms={3600000} a11y={es ? 'Una hora después' : 'One hour later'} />
      </View>
      <View style={s.row}>
        <Step dir="−" ms={5 * 60000} a11y={es ? 'Cinco minutos antes' : 'Five minutes earlier'} />
        <Text style={s.mins}>{es ? '5 min' : '5 min'}</Text>
        <Step dir="+" ms={5 * 60000} a11y={es ? 'Cinco minutos después' : 'Five minutes later'} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: C.parchment, borderRadius: 12, padding: 11, gap: 7 },
  label: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase', color: C.walnut },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontFamily: FONTS.v2_display_big, fontSize: 16, color: C.cocoa, marginTop: -2 },
  day: { fontFamily: FONTS.v2_bold, fontSize: 14, color: C.cocoa },
  time: { fontFamily: FONTS.v2_display_big, fontSize: 18, color: C.cocoa },
  mins: { fontFamily: FONTS.v2_body, fontSize: 11, color: C.walnut },
});
```

- [ ] **Step 2: Typecheck, lint, commit**

Run: `pnpm --filter mobile type-check && pnpm --filter mobile lint`
Expected: clean.

```bash
git add apps/mobile/src/components/tracker/TimeField.tsx
git commit -m "feat(tracker): pure-JS date+time control

Native pickers are native modules; using one would gate the whole feature
behind a native build. Follows the shipped quiet-hours stepper pattern."
```

---

## Task 7: The edit sheet

**Files:**
- Create: `apps/mobile/src/components/tracker/LogEditSheet.tsx`
- Modify: `apps/mobile/src/components/manual/PlaybookTracker.tsx`

- [ ] **Step 1: Create the sheet**

```tsx
// One edit sheet for every log type, driven by entry.kind.
//
// Hard edit, no trail (spec D2): saving overwrites, deleting removes. The guard
// against accidental loss is the destructive confirm, not an audit column.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { tap } from '@utils/haptics';
import { clampOz } from '@utils/logEntry';
import { useTrackerStore } from '@store/babyTracker';
import type { LogEntry, DiaperKind } from '@api/babyTracker';
import TimeField from './TimeField';

const C = {
  paper: COLORS.v2_paper, cream: COLORS.v2_cream, parchment: COLORS.v2_parchment,
  cocoa: COLORS.v2_cocoa, walnut: COLORS.v2_walnut, rose: COLORS.v2_cinnamon,
};

export default function LogEditSheet({ entry, lang, onClose }: {
  entry: LogEntry | null; lang: 'en' | 'es'; onClose: () => void;
}) {
  const es = lang === 'es';
  const store = useTrackerStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft state, re-seeded whenever a different entry opens.
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [seededId, setSeededId] = useState<string | null>(null);
  if (entry && entry.row.id !== seededId) {
    setSeededId(entry.row.id);
    setDraft(entry.kind === 'sleep' ? { started_at: entry.row.started_at, ended_at: entry.row.ended_at }
      : entry.kind === 'feed' ? { method: entry.row.method, side: entry.row.side, started_at: entry.row.started_at, ended_at: entry.row.ended_at, amount_oz: entry.row.amount_oz }
      : entry.kind === 'diaper' ? { kind: entry.row.kind, occurred_at: entry.row.occurred_at }
      : { raw_text: entry.row.raw_text, occurred_at: entry.row.occurred_at });
    setError(null);
  }

  if (!entry) return null;
  const set = (k: string, v: unknown) => setDraft((d) => ({ ...d, [k]: v }));

  const onSave = async () => {
    tap(); setBusy(true); setError(null);
    const res = await store.updateEntry(entry, draft);
    setBusy(false);
    if (res.ok) onClose();
    else setError(res.reason ?? (es ? 'No se pudo guardar.' : "That didn't save."));
  };

  const onDelete = () => {
    Alert.alert(
      es ? '¿Borrar este registro?' : 'Delete this log?',
      es ? 'No se puede deshacer.' : "This can't be undone.",
      [
        { text: es ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: es ? 'Borrar' : 'Delete', style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const res = await store.deleteEntry(entry);
            setBusy(false);
            if (res.ok) onClose();
            else setError(res.reason ?? (es ? 'No se pudo borrar.' : "That didn't delete."));
          },
        },
      ],
    );
  };

  const title = entry.kind === 'sleep' ? (es ? 'Siesta' : 'Nap')
    : entry.kind === 'feed' ? (es ? 'Toma' : 'Feed')
    : entry.kind === 'diaper' ? (es ? 'Pañal' : 'Diaper')
    : (es ? 'Nota' : 'Note');

  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, on && s.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
    >
      <Text style={[s.chipTxt, on && s.chipTxtOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={es ? 'Cerrar' : 'Close'}>
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
            {entry.kind === 'sleep' && (
              <>
                <TimeField label={es ? 'Inició' : 'Started'} value={draft.started_at as string} onChange={(v) => set('started_at', v)} lang={lang} />
                {draft.ended_at
                  ? <TimeField label={es ? 'Terminó' : 'Ended'} value={draft.ended_at as string} onChange={(v) => set('ended_at', v)} lang={lang} />
                  : (
                    <TouchableOpacity onPress={() => set('ended_at', new Date().toISOString())} style={s.ghostBtn} accessibilityRole="button">
                      <Text style={s.ghostTxt}>{es ? 'Aún durmiendo — terminar ahora' : 'Still running — end it now'}</Text>
                    </TouchableOpacity>
                  )}
              </>
            )}

            {entry.kind === 'feed' && (
              <>
                <View style={s.chipRow}>
                  <Chip on={draft.method === 'breast' && draft.side === 'left'} label={es ? 'Izq.' : 'Left'} onPress={() => setDraft((d) => ({ ...d, method: 'breast', side: 'left', amount_oz: null }))} />
                  <Chip on={draft.method === 'breast' && draft.side === 'right'} label={es ? 'Der.' : 'Right'} onPress={() => setDraft((d) => ({ ...d, method: 'breast', side: 'right', amount_oz: null }))} />
                  <Chip on={draft.method === 'bottle'} label={es ? 'Biberón' : 'Bottle'} onPress={() => setDraft((d) => ({ ...d, method: 'bottle', side: null, amount_oz: d.amount_oz ?? 3 }))} />
                </View>
                {draft.method === 'bottle' && (
                  <View style={s.ozRow}>
                    <Text style={s.ozLabel}>{es ? 'ONZAS' : 'OZ'}</Text>
                    <TouchableOpacity onPress={() => set('amount_oz', clampOz((draft.amount_oz as number ?? 0) - 0.5))} style={s.ozBtn} accessibilityRole="button" accessibilityLabel={es ? 'Menos onzas' : 'Fewer ounces'}><Text style={s.ozBtnTxt}>−</Text></TouchableOpacity>
                    <Text style={s.ozVal}>{String(draft.amount_oz ?? 0)}</Text>
                    <TouchableOpacity onPress={() => set('amount_oz', clampOz((draft.amount_oz as number ?? 0) + 0.5))} style={s.ozBtn} accessibilityRole="button" accessibilityLabel={es ? 'Más onzas' : 'More ounces'}><Text style={s.ozBtnTxt}>+</Text></TouchableOpacity>
                  </View>
                )}
                <TimeField label={es ? 'Inició' : 'Started'} value={draft.started_at as string} onChange={(v) => set('started_at', v)} lang={lang} />
                {draft.ended_at
                  ? <TimeField label={es ? 'Terminó' : 'Ended'} value={draft.ended_at as string} onChange={(v) => set('ended_at', v)} lang={lang} />
                  : (
                    <TouchableOpacity onPress={() => set('ended_at', new Date().toISOString())} style={s.ghostBtn} accessibilityRole="button">
                      <Text style={s.ghostTxt}>{es ? 'En curso — terminar ahora' : 'Still running — end it now'}</Text>
                    </TouchableOpacity>
                  )}
              </>
            )}

            {entry.kind === 'diaper' && (
              <>
                <View style={s.chipRow}>
                  {(['wet', 'dirty', 'both'] as DiaperKind[]).map((k) => (
                    <Chip key={k} on={draft.kind === k} label={es ? { wet: 'Pis', dirty: 'Caca', both: 'Ambos' }[k] : { wet: 'Wet', dirty: 'Dirty', both: 'Both' }[k]} onPress={() => set('kind', k)} />
                  ))}
                </View>
                <TimeField label={es ? 'Hora' : 'Time'} value={draft.occurred_at as string} onChange={(v) => set('occurred_at', v)} lang={lang} />
              </>
            )}

            {entry.kind === 'note' && (
              <>
                <TextInput
                  value={draft.raw_text as string}
                  onChangeText={(t) => set('raw_text', t)}
                  style={s.noteInput}
                  multiline
                  accessibilityLabel={es ? 'Texto de la nota' : 'Note text'}
                />
                <TimeField label={es ? 'Hora' : 'Time'} value={draft.occurred_at as string} onChange={(v) => set('occurred_at', v)} lang={lang} />
              </>
            )}

            {error && <Text style={s.error}>{error}</Text>}
          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity onPress={onDelete} disabled={busy} style={s.deleteBtn} accessibilityRole="button" accessibilityLabel={es ? 'Borrar registro' : 'Delete log'}>
              <Text style={s.deleteTxt}>{es ? 'Borrar' : 'Delete'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave} disabled={busy} style={[s.saveBtn, busy && { opacity: 0.5 }]} accessibilityRole="button" accessibilityState={{ busy }} accessibilityLabel={es ? 'Guardar cambios' : 'Save changes'}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveTxt}>{es ? 'Guardar' : 'Save'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(61,31,14,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.cream, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 30, maxHeight: '85%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: FONTS.headerBold, fontSize: 21, color: C.cocoa },
  close: { fontFamily: FONTS.v2_link, fontSize: 17, color: C.walnut, padding: 4 },
  chipRow: { flexDirection: 'row', gap: 7 },
  chip: { flex: 1, backgroundColor: C.parchment, borderRadius: 11, paddingVertical: 11, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  chipOn: { borderColor: C.rose, backgroundColor: C.paper },
  chipTxt: { fontFamily: FONTS.v2_bold, fontSize: 13, color: C.walnut },
  chipTxtOn: { color: C.cocoa },
  ozRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.parchment, borderRadius: 12, padding: 11 },
  ozLabel: { flex: 1, fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.4, color: C.walnut },
  ozBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  ozBtnTxt: { fontFamily: FONTS.v2_display_big, fontSize: 16, color: C.cocoa, marginTop: -2 },
  ozVal: { fontFamily: FONTS.v2_display_big, fontSize: 18, color: C.cocoa, minWidth: 34, textAlign: 'center' },
  noteInput: { backgroundColor: C.paper, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(122,74,40,0.2)', padding: 12, minHeight: 76, fontFamily: FONTS.v2_body, fontSize: 14, color: C.cocoa },
  ghostBtn: { backgroundColor: C.parchment, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ghostTxt: { fontFamily: FONTS.v2_link, fontSize: 13, color: C.walnut },
  error: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: C.rose, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  deleteBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 13, backgroundColor: C.parchment },
  deleteTxt: { fontFamily: FONTS.v2_link, fontSize: 14, color: '#A33' },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 13, backgroundColor: C.rose, alignItems: 'center' },
  saveTxt: { fontFamily: FONTS.v2_link, fontSize: 14, color: '#fff' },
});
```

- [ ] **Step 2: Render it from `PlaybookTracker`**

Add the import and render the sheet just before the component's closing `</View>`:

```tsx
import LogEditSheet from '@components/tracker/LogEditSheet';
```

```tsx
      <LogEditSheet entry={editing} lang={lang} onClose={() => setEditing(null)} />
```

- [ ] **Step 3: Typecheck, lint**

Run: `pnpm --filter mobile type-check && pnpm --filter mobile lint`
Expected: clean.

- [ ] **Step 4: Verify against the seeded failure cases**

In the simulator, on Insights:
1. Tap the wrong-side breast feed (failure case 4) → flip Left/Right → Save → the timeline label updates.
2. Tap one of the duplicate feeds (case 3) → Delete → confirm → the row disappears.
3. Tap the 11.5oz bottle (case 6) → step ounces down → Save.
4. Tap a note → edit the text → Save.
5. Open the still-running nap (case 1) and confirm the sheet offers "Still running — end it now".

Each change must survive a pull-to-refresh — that proves it hit the database, not just local state.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/tracker/LogEditSheet.tsx apps/mobile/src/components/manual/PlaybookTracker.tsx
git commit -m "feat(tracker): edit and delete any log from the timeline"
```

---

## Task 8: Back-dating at log time

**Files:**
- Create: `apps/mobile/src/components/tracker/TimeChips.tsx`
- Modify: `apps/mobile/src/components/manual/PlaybookTracker.tsx`

- [ ] **Step 1: Create the chips**

```tsx
// "When did this happen?" — back-dating at log time.
//
// Defaults to now and RESETS to now after every log, so a stale selection can
// never silently mis-stamp the next entry. ⌄ opens the full TimeField.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { select } from '@utils/haptics';
import { minutesAgoISO } from '@utils/logEntry';
import TimeField from './TimeField';

const C = { paper: COLORS.v2_paper, parchment: COLORS.v2_parchment, cocoa: COLORS.v2_cocoa, walnut: COLORS.v2_walnut, rose: COLORS.v2_cinnamon };

const OFFSETS = [0, 15, 30, 60] as const;

export default function TimeChips({ valueIso, onChange, lang }: {
  valueIso: string | null;              // null === now
  onChange: (iso: string | null) => void;
  lang: 'en' | 'es';
}) {
  const es = lang === 'es';
  const [expanded, setExpanded] = useState(false);
  const label = (m: number) => (m === 0 ? (es ? 'ahora' : 'now') : `${m}m`);

  // A chip is selected when the value is within 90s of that offset.
  const selectedOffset = (m: number) => {
    if (m === 0) return valueIso === null;
    if (!valueIso) return false;
    return Math.abs(Date.parse(minutesAgoISO(m, Date.now())) - Date.parse(valueIso)) < 90_000;
  };

  return (
    <View style={{ gap: 8, marginTop: 9 }}>
      <View style={s.row}>
        {OFFSETS.map((m) => {
          const on = selectedOffset(m);
          return (
            <TouchableOpacity
              key={m}
              onPress={() => { select(); setExpanded(false); onChange(m === 0 ? null : minutesAgoISO(m, Date.now())); }}
              style={[s.chip, on && s.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={m === 0 ? (es ? 'Ahora' : 'Now') : (es ? `Hace ${m} minutos` : `${m} minutes ago`)}
            >
              <Text style={[s.txt, on && s.txtOn]}>{label(m)}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => { select(); if (!valueIso) onChange(new Date().toISOString()); setExpanded((e) => !e); }}
          style={[s.chip, expanded && s.chipOn]}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={es ? 'Elegir fecha y hora' : 'Pick a date and time'}
        >
          <Text style={[s.txt, expanded && s.txtOn]}>⌄</Text>
        </TouchableOpacity>
      </View>
      {expanded && valueIso && (
        <TimeField label={es ? 'Ocurrió' : 'Happened'} value={valueIso} onChange={onChange} lang={lang} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, backgroundColor: C.parchment, borderRadius: 9, paddingVertical: 7, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  chipOn: { borderColor: C.rose, backgroundColor: C.paper },
  txt: { fontFamily: FONTS.v2_bold, fontSize: 11, color: C.walnut },
  txtOn: { color: C.cocoa },
});
```

- [ ] **Step 2: Wire into each pane**

In `PlaybookTracker.tsx`, add state and the reset helper:

```tsx
const [logAt, setLogAt] = useState<string | null>(null);   // null === now
const resetTime = () => setLogAt(null);
```

Pass `logAt ?? undefined` into every log call and reset afterwards:

```tsx
  const onStartSleep = async () => {
    if (!babyProfileId) return onNeedBaby?.();
    select();
    await store.startSleep(logAt ?? undefined);
    resetTime();
    await scheduleWakeAlarm(wakeMin * 60, babyName);
  };
  const onStartFeed = (method: 'breast' | 'bottle', side: 'left' | 'right' | null) => {
    if (!babyProfileId) return onNeedBaby?.();
    select(); setOzDraft(3);
    store.startFeed(method, side, logAt ?? undefined);
    resetTime();
  };
  const onDiaper = (kind: 'wet' | 'dirty' | 'both') => {
    if (!babyProfileId) return onNeedBaby?.();
    tap();
    store.logDiaper(kind, logAt ?? undefined);
    resetTime();
  };
  // Finished bottle — no timer. This wires the previously-unreachable logBottle path.
  const onLogFinishedBottle = () => {
    if (!babyProfileId) return onNeedBaby?.();
    tap();
    store.logBottle(ozDraft, logAt ?? undefined);
    resetTime();
  };
```

Render `<TimeChips valueIso={logAt} onChange={setLogAt} lang={lang} />` at the bottom of each of the three panes (sleep, feed, diaper) — inside the `styles.panel` view, after the existing controls.

In the feed pane's non-running branch, add the finished-bottle button below the L/R/bottle row:

```tsx
<TouchableOpacity onPress={onLogFinishedBottle} style={styles.startBtn} accessibilityRole="button" accessibilityLabel={es ? 'Registrar biberón terminado' : 'Log a finished bottle'}>
  <Text style={styles.startBtnText}>{es ? `biberón terminado · ${ozDraft} oz` : `finished bottle · ${ozDraft} oz`}</Text>
</TouchableOpacity>
```

Add the import:

```tsx
import TimeChips from '@components/tracker/TimeChips';
```

- [ ] **Step 3: Typecheck, lint**

Run: `pnpm --filter mobile type-check && pnpm --filter mobile lint`
Expected: clean.

- [ ] **Step 4: Verify in the simulator**

1. Open the diaper pane, tap `30m`, tap `wet`. The new timeline row must read 30 minutes ago, not now.
2. Confirm the chip snapped back to `now` — log a second diaper and check it stamps the current time.
3. Tap `⌄`, step back a day, log a diaper, and confirm it does **not** appear in today's timeline (it belongs to yesterday — it will show in History after Task 10).
4. Log a finished bottle and confirm one row appears with the ounces and no running timer.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/tracker/TimeChips.tsx apps/mobile/src/components/manual/PlaybookTracker.tsx
git commit -m "feat(tracker): back-date a log to when it actually happened

Also wires the finished-bottle path, which existed in the API and store but
had no UI — a completed bottle previously required running a fake timer."
```

---

## Task 9: Runaway timer rescue

**Files:**
- Modify: `apps/mobile/src/components/manual/PlaybookTracker.tsx`

- [ ] **Step 1: Add the rescue state and handlers**

Add the import and state:

```tsx
import { isRunaway } from '@utils/logEntry';
```

```tsx
const [rescueDismissed, setRescueDismissed] = useState(false);
const sleepRunaway = !!activeSleep && !rescueDismissed && isRunaway('sleep', activeSleep.started_at, nowMs);
const feedRunaway = !!activeFeed && !rescueDismissed && isRunaway('feed', activeFeed.started_at, nowMs);
```

```tsx
  const onDiscardSleep = () => {
    Alert.alert(
      es ? '¿Descartar esta siesta?' : 'Discard this nap?',
      es ? 'Se borrará por completo.' : "It'll be deleted entirely.",
      [
        { text: es ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: es ? 'Descartar' : 'Discard', style: 'destructive',
          onPress: async () => {
            if (!activeSleep) return;
            await cancelWakeAlarm();
            await store.deleteEntry({ kind: 'sleep', row: activeSleep });
          },
        },
      ],
    );
  };
```

Add `Alert` to the `react-native` import list.

- [ ] **Step 2: Render the rescue prompt**

Inside the live sleep card (`styles.sleepActive`), replace the single stop button row with a branch. When `sleepRunaway`, render:

```tsx
{sleepRunaway ? (
  <View style={{ gap: 9, marginTop: 10 }}>
    <Text style={styles.rescueAsk}>
      {es ? '¿Sigue durmiendo, o el cronómetro quedó corriendo?' : 'Still asleep, or did the timer keep running?'}
    </Text>
    <View style={{ flexDirection: 'row', gap: 7 }}>
      <TouchableOpacity onPress={() => { select(); setRescueDismissed(true); }} style={styles.rescueBtn} accessibilityRole="button">
        <Text style={styles.rescueBtnTxt}>{es ? 'sigue durmiendo' : 'still asleep'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { select(); setEditing({ kind: 'sleep', row: activeSleep! }); }} style={styles.rescueBtn} accessibilityRole="button">
        <Text style={styles.rescueBtnTxt}>{es ? 'terminó a las…' : 'ended at…'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDiscardSleep} style={[styles.rescueBtn, styles.rescueDanger]} accessibilityRole="button">
        <Text style={[styles.rescueBtnTxt, { color: '#fff' }]}>{es ? 'descartar' : 'discard'}</Text>
      </TouchableOpacity>
    </View>
  </View>
) : null}
```

And in the non-runaway branch, alongside the existing `stop` button, add the always-available correction:

```tsx
<TouchableOpacity onPress={() => { select(); setEditing({ kind: 'sleep', row: activeSleep }); }} style={styles.endedAtBtn} accessibilityRole="button" accessibilityLabel={es ? 'Corregir la hora de fin' : 'Correct the end time'}>
  <Text style={styles.endedAtTxt}>{es ? 'terminó a las…' : 'ended at…'}</Text>
</TouchableOpacity>
```

Apply the same two additions to the live feed card, using `feedRunaway` and `{ kind: 'feed', row: activeFeed }`.

Add the styles:

```tsx
  rescueAsk: { fontFamily: FONTS.v2_body, fontSize: 12, color: C.claySub, lineHeight: 17 },
  rescueBtn: { flex: 1, backgroundColor: 'rgba(255,249,242,0.2)', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  rescueDanger: { backgroundColor: '#9A4E28' },
  rescueBtnTxt: { fontFamily: FONTS.v2_bold, fontSize: 11, color: C.clayInk },
  endedAtBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  endedAtTxt: { fontFamily: FONTS.v2_link, fontSize: 11.5, color: C.claySub },
```

- [ ] **Step 3: Typecheck, lint**

Run: `pnpm --filter mobile type-check && pnpm --filter mobile lint`
Expected: clean.

- [ ] **Step 4: Verify against the seeded failure cases**

1. The 26h-open nap (case 1) shows the escalated prompt. Tap `ended at…`, set a sensible end time, Save.
2. Before fixing it, note `avg nap` and `avg wake window` in Insights. After fixing, both must visibly change — that is the proof this matters.
3. Start a fresh nap and confirm the ordinary card shows `ended at…` **without** the escalated prompt.
4. On a runaway, tap `still asleep` and confirm the prompt stays gone until the screen remounts.
5. On a runaway, tap `discard` and confirm the row is deleted and a new nap can be started.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/manual/PlaybookTracker.tsx
git commit -m "feat(tracker): rescue a forgotten timer before it skews the week

A nap nobody stopped distorts avgNapMin and avgWakeWindowMin across the whole
7-day Insights window. 'ended at…' is always available; the three-way prompt
only escalates past 12h sleep / 2h feed, so real overnight sleep is never nagged."
```

---

## Task 10: History screen

**Files:**
- Create: `apps/mobile/src/screens/home/LogHistoryScreen.tsx`
- Modify: `apps/mobile/src/navigation/HomeNavigator.tsx`
- Modify: `apps/mobile/src/screens/home/InsightsScreen.tsx`

- [ ] **Step 1: Create the screen**

```tsx
// Log history — every day you've logged, newest first, all of it editable.
//
// Pages a week at a time via babyTrackerApi.getRange, groups into LOCAL days
// (dayKeyLocal, not the UTC slice the tracker used to group on), and renders
// the same LogTimeline rows the tracker does so an edit works identically here.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { babyTrackerApi, type TodayLogs, type LogEntry } from '@api/babyTracker';
import { groupByDay } from '@utils/logEntry';
import { FONTS } from '@utils/constants';
import { BackButton } from '@components/shared/BackButton';
import { useUserStore } from '@store/user';
import LogTimeline, { buildTimeline, type TimelineItem } from '@components/tracker/LogTimeline';
import LogEditSheet from '@components/tracker/LogEditSheet';

const C = { cream: '#FCF7EF', paper: '#FFFCF6', cocoa: '#3D2116', walnut: '#8A6A55', roseInk: '#9E2F4C', muted: '#A6957F' };
const PAGE_DAYS = 7;

const EMPTY: TodayLogs = { sleep: [], feeds: [], diapers: [], notes: [] };
const merge = (a: TodayLogs, b: TodayLogs): TodayLogs => ({
  sleep: [...a.sleep, ...b.sleep], feeds: [...a.feeds, ...b.feeds],
  diapers: [...a.diapers, ...b.diapers], notes: [...a.notes, ...b.notes],
});

export default function LogHistoryScreen() {
  const lang = (useUserStore.getState().profile?.preferred_language ?? 'en') as 'en' | 'es';
  const es = lang === 'es';
  const [logs, setLogs] = useState<TodayLogs>(EMPTY);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LogEntry | null>(null);

  const loadPage = useCallback(async (pageIndex: number) => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const to = new Date(end.getTime() - pageIndex * PAGE_DAYS * 86400000);
    const from = new Date(to.getTime() - PAGE_DAYS * 86400000);
    const page = await babyTrackerApi.getRange(from.toISOString(), to.toISOString());
    setLogs((prev) => (pageIndex === 0 ? page : merge(prev, page)));
    setPages(pageIndex + 1);
    setLoading(false);
  }, []);

  useEffect(() => { loadPage(0); }, [loadPage]);

  // Re-pull everything currently loaded, so an edit is reflected on every page.
  const reload = useCallback(async () => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const from = new Date(end.getTime() - pages * PAGE_DAYS * 86400000);
    setLogs(await babyTrackerApi.getRange(from.toISOString(), end.toISOString()));
  }, [pages]);

  const days = groupByDay<TimelineItem>(buildTimeline(logs, es), (i) => i.iso);

  const dayHeading = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - date.getTime()) / 86400000);
    if (diff === 0) return es ? 'hoy' : 'today';
    if (diff === 1) return es ? 'ayer' : 'yesterday';
    return date.toLocaleDateString(es ? 'es-US' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <View style={s.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <BackButton color={C.roseInk} />
          <Text style={s.title}>{es ? 'tus registros' : 'your logs'}</Text>
          <View style={{ width: 30 }} />
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={C.roseInk} /></View>
        ) : days.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptyTitle}>{es ? 'Todavía nada' : 'Nothing logged yet'}</Text>
            <Text style={s.emptyBody}>{es ? 'Lo que registres aparecerá aquí, día por día.' : 'What you log shows up here, day by day.'}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 90, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
            {days.map((day) => (
              <View key={day.dayKey} style={{ marginBottom: 18 }}>
                <Text style={s.dayHead}>{dayHeading(day.dayKey)}</Text>
                <View style={s.dayCard}>
                  <LogTimeline items={day.items} lang={lang} onPressItem={setEditing} />
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={() => loadPage(pages)} style={s.moreBtn} accessibilityRole="button">
              <Text style={s.moreTxt}>{es ? 'cargar semana anterior' : 'load the week before'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>

      <LogEditSheet entry={editing} lang={lang} onClose={() => { setEditing(null); reload(); }} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  title: { fontFamily: FONTS.headerBold, fontSize: 28, color: C.cocoa, letterSpacing: -0.5 },
  dayHead: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', color: C.walnut, marginBottom: 7 },
  dayCard: { backgroundColor: C.paper, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(61,31,14,0.09)' },
  moreBtn: { alignItems: 'center', paddingVertical: 16 },
  moreTxt: { fontFamily: FONTS.v2_link, fontSize: 13, color: C.roseInk },
  emptyTitle: { fontFamily: FONTS.headerBold, fontSize: 19, color: C.cocoa, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 20, color: C.muted, textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 2: Register the route**

In `apps/mobile/src/navigation/HomeNavigator.tsx`, add the import alongside the other home-screen imports, and the screen after the `Insights` line:

```tsx
import LogHistoryScreen from '@/screens/home/LogHistoryScreen';
```

```tsx
      <Stack.Screen name="LogHistory" component={LogHistoryScreen} />
```

- [ ] **Step 3: Wire "see all" from Insights**

In `apps/mobile/src/screens/home/InsightsScreen.tsx`, pass the callback to the tracker:

```tsx
            <PlaybookTracker
              babyProfileId={babyProfile?.id ?? null}
              babyName={babyProfile?.baby_name ?? 'baby'}
              week={week ?? 1}
              lang={lang}
              initialPane={route.params?.pane}
              onNeedBaby={() => nav.navigate('BabyProfileSetup')}
              onSeeAll={() => nav.navigate('LogHistory')}
            />
```

- [ ] **Step 4: Typecheck, lint**

Run: `pnpm --filter mobile type-check && pnpm --filter mobile lint`
Expected: clean.

- [ ] **Step 5: Verify against the seeded month**

1. Tap "see all ›" from Insights. The first week of days renders, newest first.
2. Tap "load the week before" three times to reach the full 30 days. Scrolling stays smooth.
3. The empty day (failure case 7) renders as an absent day — no crash, no blank card.
4. Edit a log from 3 weeks back, close the sheet, and confirm the row updates in place.
5. Confirm the back-dated diaper from Task 8 step 4 now appears on yesterday.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/home/LogHistoryScreen.tsx apps/mobile/src/navigation/HomeNavigator.tsx apps/mobile/src/screens/home/InsightsScreen.tsx
git commit -m "feat(tracker): browse and fix any past day, not just today"
```

---

## Task 11: Migration 123 — note linkage and group undo

The only step needing a deploy. Sequenced last so the six OTA-able steps above ship without waiting on it.

**Files:**
- Create: `supabase/migrations/123_baby_log_note_linkage.sql`
- Modify: `supabase/functions/playbook-parse-note/index.ts`
- Modify: `apps/mobile/src/api/babyTracker.ts`
- Modify: `apps/mobile/src/components/tracker/LogEditSheet.tsx`

- [ ] **Step 1: Confirm 123 is still free**

Run: use the Supabase MCP `list_migrations`, or `supabase migration list`.
Expected: highest applied is `122`. If a concurrent session has taken 123, use the next free number and rename the file — do not reuse a number.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/123_baby_log_note_linkage.sql`:

```sql
-- 123_baby_log_note_linkage.sql
-- Link AI-parsed log rows back to the jot they came from.
--
-- playbook-parse-note inserts rows with source='note' but no reference to the
-- note, so a mis-heard jot ("she fed at 3") produces orphan rows the mom can
-- neither trace nor undo as a group. ON DELETE SET NULL, deliberately: deleting
-- the jot must never cascade away real logs she wants to keep.
--
-- Rows written before this migration keep note_id = NULL and simply don't offer
-- the group-undo affordance. No backfill is possible or needed.

ALTER TABLE baby_sleep_logs
  ADD COLUMN IF NOT EXISTS note_id UUID REFERENCES baby_log_notes(id) ON DELETE SET NULL;
ALTER TABLE baby_feed_logs
  ADD COLUMN IF NOT EXISTS note_id UUID REFERENCES baby_log_notes(id) ON DELETE SET NULL;
ALTER TABLE baby_diaper_logs
  ADD COLUMN IF NOT EXISTS note_id UUID REFERENCES baby_log_notes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_baby_sleep_note  ON baby_sleep_logs(note_id)  WHERE note_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_baby_feed_note   ON baby_feed_logs(note_id)   WHERE note_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_baby_diaper_note ON baby_diaper_logs(note_id) WHERE note_id IS NOT NULL;
```

- [ ] **Step 3: Apply it**

```bash
cd "/Users/gp/The Village App/village-app/.worktrees/log-editing"
supabase db push
```

Expected: `123_baby_log_note_linkage.sql` applied. This worktree is based on `main`, so 118–122 are present locally and the push will not fail the missing-version check.

- [ ] **Step 4: Stamp `note_id` in the parser**

In `supabase/functions/playbook-parse-note/index.ts`, the three insert calls (around lines 119–125) each gain `note_id: noteId`:

```ts
        inserts.push(supabase.from('baby_sleep_logs').insert({ user_id: uid, baby_profile_id, started_at: e.started_at, ended_at: e.ended_at, source: 'note', note_id: noteId }));
```

```ts
        inserts.push(supabase.from('baby_feed_logs').insert({ user_id: uid, baby_profile_id, method: e.method, side: e.side, started_at: e.started_at, ended_at: e.ended_at, amount_oz: e.amount_oz, source: 'note', note_id: noteId }));
```

```ts
        inserts.push(supabase.from('baby_diaper_logs').insert({ user_id: uid, baby_profile_id, kind: e.kind, occurred_at: e.occurred_at, source: 'note', note_id: noteId }));
```

Deploy it — and note that `functions deploy` bundles the **working tree**, not HEAD, so commit first:

```bash
git add supabase/functions/playbook-parse-note/index.ts supabase/migrations/123_baby_log_note_linkage.sql
git commit -m "feat(tracker): link AI-parsed rows back to their jot (mig 123)"
supabase functions deploy playbook-parse-note
```

- [ ] **Step 5: Add the group-undo API**

In `apps/mobile/src/api/babyTracker.ts`, add to `babyTrackerApi`:

```ts
  // Every row a given jot produced — powers "remove what Villie logged from this".
  async getNoteExtractions(noteId: string): Promise<{ sleep: number; feed: number; diaper: number }> {
    const [s, f, d] = await Promise.all([
      supabase.from('baby_sleep_logs').select('id', { count: 'exact', head: true }).eq('note_id', noteId),
      supabase.from('baby_feed_logs').select('id', { count: 'exact', head: true }).eq('note_id', noteId),
      supabase.from('baby_diaper_logs').select('id', { count: 'exact', head: true }).eq('note_id', noteId),
    ]);
    return { sleep: s.count ?? 0, feed: f.count ?? 0, diaper: d.count ?? 0 };
  },

  async deleteNoteExtractions(noteId: string): Promise<MutationResult> {
    const results = await Promise.all([
      supabase.from('baby_sleep_logs').delete().eq('note_id', noteId),
      supabase.from('baby_feed_logs').delete().eq('note_id', noteId),
      supabase.from('baby_diaper_logs').delete().eq('note_id', noteId),
    ]);
    const failed = results.find((r) => r.error);
    return failed?.error ? mutationError('deleteNoteExtractions', failed.error) : { ok: true };
  },
```

- [ ] **Step 6: Offer the group undo in the sheet**

In `LogEditSheet.tsx`, add state and load the counts when a note opens:

```tsx
const [extracted, setExtracted] = useState<{ sleep: number; feed: number; diaper: number } | null>(null);

useEffect(() => {
  if (entry?.kind !== 'note') { setExtracted(null); return; }
  babyTrackerApi.getNoteExtractions(entry.row.id).then(setExtracted).catch(() => setExtracted(null));
}, [entry]);
```

Add the imports (`useEffect` from react, `babyTrackerApi` from `@api/babyTracker`), and render inside the note branch, below the `TimeField`:

```tsx
{extracted && extracted.sleep + extracted.feed + extracted.diaper > 0 && (
  <View style={s.extractCard}>
    <Text style={s.extractTxt}>
      {es
        ? `villie registró ${extracted.feed} toma(s), ${extracted.sleep} sueño, ${extracted.diaper} pañal(es) de esta nota.`
        : `villie logged ${extracted.feed} feed(s), ${extracted.sleep} sleep, ${extracted.diaper} diaper(s) from this note.`}
    </Text>
    <TouchableOpacity
      onPress={() => Alert.alert(
        es ? '¿Quitar lo que villie registró?' : "Remove what villie logged?",
        es ? 'La nota se queda; los registros que sacó de ella se borran.' : 'The note stays; the entries it created are deleted.',
        [
          { text: es ? 'Cancelar' : 'Cancel', style: 'cancel' },
          {
            text: es ? 'Quitar' : 'Remove', style: 'destructive',
            onPress: async () => {
              setBusy(true);
              const res = await babyTrackerApi.deleteNoteExtractions(entry.row.id);
              setBusy(false);
              if (res.ok) onClose(); else setError(res.reason ?? null);
            },
          },
        ],
      )}
      accessibilityRole="button"
      accessibilityLabel={es ? 'Quitar los registros de esta nota' : 'Remove the entries from this note'}
    >
      <Text style={s.extractLink}>{es ? 'quitar esos registros' : 'remove those entries'}</Text>
    </TouchableOpacity>
  </View>
)}
```

```tsx
  extractCard: { backgroundColor: '#FBEFD9', borderRadius: 12, padding: 12, gap: 7 },
  extractTxt: { fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 18, color: C.cocoa },
  extractLink: { fontFamily: FONTS.v2_link, fontSize: 12.5, color: C.rose },
```

- [ ] **Step 7: Verify end to end**

1. In the app, jot "she fed at 3 and napped after". Wait for the parse.
2. Open History, tap that note. The sheet reports what Villie extracted.
3. Tap "remove those entries", confirm. The parsed rows disappear; the note remains.
4. Delete the note itself and confirm any remaining parsed rows are **not** deleted (that's the `ON DELETE SET NULL` behavior).

- [ ] **Step 8: Typecheck, lint, commit**

```bash
pnpm --filter mobile type-check && pnpm --filter mobile lint && pnpm --filter mobile test
git add apps/mobile/src/api/babyTracker.ts apps/mobile/src/components/tracker/LogEditSheet.tsx
git commit -m "feat(tracker): undo everything a mis-parsed jot logged"
```

---

## Task 12: Clean up and hand off

- [ ] **Step 1: Remove the seeded month**

```bash
pnpm logs:unseed
```

Expected: per-type deletion counts, undo file cleared. **Do this before any OTA** — the founder's real Insights must not narrate seeded data.

- [ ] **Step 2: Confirm the account is clean**

Open Insights. The week stepper should show only real logs. If any seeded rows survived, `scratchpad/seeded-log-ids.json` recorded them — check it before hand-deleting anything.

- [ ] **Step 3: Full verification pass**

```bash
pnpm --filter mobile type-check
pnpm --filter mobile lint
pnpm --filter mobile test
```

Expected: all three clean.

- [ ] **Step 4: Confirm the Day Sheet still renders**

The Day Sheet (migration 102, `day-sheet-page` edge function) reads these same tables. Generate one and confirm it renders after logs have been edited and deleted underneath it.

- [ ] **Step 5: Merge and clean up the worktree**

```bash
cd "/Users/gp/The Village App/village-app"
git checkout main && git merge --no-ff feat/log-editing
git worktree remove .worktrees/log-editing
```

Note: the shared checkout may be parked on another branch and used by a concurrent session — check `git branch --show-current` first and do not switch branches out from under it. If it is busy, leave the merge to the founder and say so.

---

## Self-review notes

**Spec coverage:** gap 1 → Tasks 5+7; gap 2 → Task 8; gap 3 → Task 9; gap 4 → Task 11; gap 5 → Task 10; gap 6 (`stopFeed` oz, dead `logBottle`) → Tasks 2+8. Month simulation → Tasks 4+12. All seven seeded failure cases have a named verification step.

**Two spec amendments made here, both forced by the codebase:**
1. The spec's "full date+time picker" is implemented as a pure-JS `TimeField`. A native picker would gate every OTA-able step behind a native build.
2. `dayKeyLocal` replaces the UTC `iso.slice(0,10)` grouping. This is a pre-existing Insights bug (evening feeds counted on the next day, deflating `feedsPerDay`), not new scope — but History grouping can't be built on the broken helper.
