# Logging mechanics — editable, flexible baby logs

**Date:** 2026-08-13
**Branch:** `feat/log-editing` (worktree `.worktrees/log-editing`, based on `main`)
**Status:** design approved, plan pending

---

## Problem

The V5 Playbook tracker (migration 093) logs sleep, feeds, diapers, and free-form
notes. It is write-only. A mom who mis-taps, or who logs the 3am feed at 7am, is
stuck with wrong data forever — and that data is what Insights narrates back to
her and what the Day Sheet hands to a caregiver.

Six concrete gaps, all verified in the shipped code:

1. **Nothing is editable or deletable.** `api/babyTracker.ts` has zero `delete`
   calls and exactly one `update` (setting `ended_at` to stop a timer). The
   "TODAY" timeline rows in `PlaybookTracker.tsx` are plain `View`s — not
   touchable. Tapping *dirty* instead of *wet*, or *Left* instead of *Right*, is
   permanent.
2. **Every log stamps `now()`.** The API signatures accept `at` / `startedAt`,
   but no UI passes them. `store.startSleep()`, `store.logDiaper(kind)`, and
   `store.startFeed(method, side)` all call through with the timestamp omitted.
3. **A forgotten timer silently poisons the stats.** `uniq_baby_sleep_active`
   permits one open session, and `getToday()` pulls `ended_at IS NULL` rows of
   *any* age. A nap nobody stopped shows as "in progress" indefinitely, blocks
   the next nap, and once closed inflates `avgNapMin` and `avgWakeWindowMin`
   across the whole 7-day Insights window.
4. **AI jot-parse is unauditable.** `playbook-parse-note` inserts rows with
   `source: 'note'` but writes **no foreign key back to the note**. When Villie
   mishears "she fed at 3", the resulting rows are orphans — untraceable and
   individually undoable at best.
5. **Today-only.** `getToday()` is hardcoded to local midnight onward, and the
   timeline hard-caps at 8 rows with no "see all". Insights already reads 3–7
   days back, so the mom can see a week of numbers she has no way to correct.
6. **Minor:** `stopFeed`'s `if (amountOz != null)` guard makes `amount_oz`
   impossible to *clear* once set; `logBottle` exists in the API and store but
   no UI calls it, so a finished bottle requires running a fake timer.

## Non-goals

- Unifying the four tables into a single `baby_events` table.
- Soft-delete, `deleted_at`, or any edit audit trail (see Decisions).
- Changing the one-tap behavior of the three big Sleep/Feed/Diaper pills.
- Reworking Insights' stat math beyond what the runaway-timer fix corrects.
- Bulk or multi-select editing.

---

## Decisions

### D1 — Keep the four tables; unify at the API layer

Alternatives considered:

- **Unify into `baby_events`** (`kind` + JSONB attrs). Cleanest long-term and a
  single edit path, but requires migrating live production rows and rewriting
  `getToday`, `getRecentStats`, `playbook-parse-note`, Billy's `logBabyEvent`
  and `getBabyTrackingStats` tools, the Day Sheet (migration 102 +
  `day-sheet-page` edge function), and Insights. High risk on a shipped feature
  for no user-visible gain. **Rejected.**
- **Four independent edit paths.** Least API code, four near-duplicate edit
  forms in the UI. **Rejected** — the duplication lands in the layer that is
  hardest to keep consistent.
- **Four tables, one façade.** A `LogEntry` discriminated union plus
  `updateEntry` / `deleteEntry` dispatching by kind. The UI renders one edit
  sheet driven by `entry.kind`. **Chosen.**

Edit and delete require **no migration**: migration 093 already creates
owner-scoped `UPDATE` and `DELETE` policies on all four tables.

### D2 — Hard edit, no trail

Editing overwrites the row; deleting removes it. No `edited_at`, no
`deleted_at`, no recovery.

Rationale: these are the mom's private logs, and the app's standing posture is
"patterns from your own logs — not medical advice". A soft-delete column would
force every read path (`getToday`, `getRecentStats`, the Day Sheet function,
Billy's tools, `playbook-parse-note`) to filter on `deleted_at IS NULL`, which
is exactly where a missed filter becomes a silent correctness bug. The guard
against accidental loss is a destructive-style confirm on delete, not a trail.

### D3 — Edit/delete surface their failures

Logging fails soft on purpose — `console.warn` and return `null`, so the UI
degrades if a migration hasn't landed. Edit and delete must **not** inherit
this. A delete that silently no-ops is worse than no delete button at all.
These methods return `{ ok: boolean; reason?: string }` and the sheet renders
the reason.

### D4 — Seed target: founder's account, with an exact-row-id undo

The month-long simulation writes into the founder's own account on hosted
Supabase, recording every inserted row id to a local JSON file. The wipe deletes
exactly those ids, so pre-existing real logs cannot be caught by it.

---

## Design

### 1 · Data layer — `apps/mobile/src/api/babyTracker.ts`

A shared entry type, formalizing what `buildTimeline` already constructs ad hoc:

```ts
export type LogKind = 'sleep' | 'feed' | 'diaper' | 'note';

export type LogEntry =
  | { kind: 'sleep';  row: SleepLog }
  | { kind: 'feed';   row: FeedLog }
  | { kind: 'diaper'; row: DiaperLog }
  | { kind: 'note';   row: NoteLog };

export interface MutationResult { ok: boolean; reason?: string }
```

New methods:

| method | purpose |
|---|---|
| `updateSleep(id, patch)` | `started_at`, `ended_at` |
| `updateFeed(id, patch)` | `method`, `side`, `started_at`, `ended_at`, `amount_oz` |
| `updateDiaper(id, patch)` | `kind`, `occurred_at` |
| `updateNote(id, patch)` | `raw_text`, `occurred_at` |
| `deleteEntry(kind, id)` | single dispatch across the four tables |
| `getDay(dateISO)` | generalizes `getToday()`; `getToday()` becomes `getDay(today)` |
| `getRange(fromISO, toISO)` | day-grouped history paging |
| `getOpenSessions()` | open sleep + feed rows with elapsed time, for the rescue |
| `deleteNoteExtractions(noteId)` | group-undo for a mis-parsed jot (see §6) |

Validation lives in this layer — once — because both the edit sheet and
back-dated logging need it:

- `started_at <= ended_at`
- no future timestamps
- an edit must not create a **second** open session. The
  `uniq_baby_sleep_active` / `uniq_baby_feed_active` partial indexes reject this
  with a raw Postgres unique-violation; catch code `23505` and return a readable
  reason rather than leaking it.
- feed: `side` must be `null` when `method = 'bottle'`; `amount_oz` must be
  `null` when `method = 'breast'`; oz within 0–12 (matching the existing stepper
  clamp)
- `updateFeed` must distinguish "leave oz alone" from "clear oz". The current
  `stopFeed` bug (`if (amountOz != null) patch.amount_oz = amountOz`) is fixed by
  keying off property presence rather than value nullness.

`getToday`'s open-session clause is bounded: today currently means
`.or('started_at.gte.<midnight>,ended_at.is.null')`, which drags in open
sessions of any age. It becomes an open-session window of the last 24 hours.
Anything older reaches the user only through the rescue prompt (§4).

### 2 · Store — `apps/mobile/src/store/babyTracker.ts`

Adds `updateEntry(entry, patch)` and `deleteEntry(entry)`, each writing through
the API then calling the existing `refresh(babyProfileId)`. The logging actions
grow an optional timestamp argument (`startSleep(at?)`, `logDiaper(kind, at?)`,
`startFeed(method, side, at?)`, `logBottle(oz, at?)`) — passed straight through
to the API params that already exist.

### 3 · Back-dating at log time

The three big pills keep logging *now* on one tap. That behavior is untouched.

Each open pane gains a compact time-chip row, defaulting to **now**:

```
diaper pane:   [ wet ]  [ dirty ]  [ both ]
               now · 15m · 30m · 1h · ⌄
```

- `⌄` opens a full date + time picker (for "yesterday at 3am").
- The selection **resets to `now` after every log**, so a stale chip can never
  silently mis-stamp the next entry.
- For sleep and feed, back-dating the *start* is the natural fix for "the nap
  began before I opened the app" — the live timer simply opens already reading
  20:00.

The dead `logBottle` path gets wired here too: a "finished bottle" affordance in
the feed pane logs `started_at == ended_at` with an oz value, so a completed
bottle no longer requires running a fake timer.

### 4 · Runaway timer rescue

The highest-leverage data-quality fix. One forgotten overnight nap currently
skews both `avgNapMin` and `avgWakeWindowMin` across the entire 7-day window
Insights reads.

Two tiers:

- **Always available:** the live timer card (both the sleep card and the feed
  card) gains an **"ended at…"** control, opening a time picker that closes the
  session at a corrected time. Available whenever a timer runs, not only when
  something is wrong.
- **Escalated:** past an unambiguous ceiling — sleep > 12h, feed > 2h — the card
  switches to a prompt offering `still running` / `ended at…` / `discard`.
  `discard` deletes the row outright.

Thresholds are deliberately conservative. A mom who logs overnight sleep has a
legitimate 8-hour session; 12h is chosen so a real session is never nagged. The
*always-available* control is what covers the ordinary "I forgot for two hours"
case.

### 5 · History — `LogHistoryScreen`

A new screen: day-grouped, paged backward via `getRange`, every row opening the
same edit sheet. Reached from a "see all →" affordance on the TODAY timeline
(which currently caps at 8 rows with no escape) and from Insights.

**Refactor pulled in:** `PlaybookTracker.tsx` is 510 lines and this work adds
time chips and touchable rows to it. Its timeline (`buildTimeline` + the row
rendering) is extracted into a `LogTimeline` component consumed by both the
tracker (today, capped, with "see all") and `LogHistoryScreen` (full,
day-grouped). This is reuse-driven, not cosmetic — History needs identical row
rendering.

New files land under `apps/mobile/src/components/tracker/`:
`LogTimeline.tsx`, `LogEditSheet.tsx`, `TimeChips.tsx`.

### 6 · Edit sheet — `LogEditSheet`

One bottom sheet, driven by `entry.kind`.

| kind | fields |
|---|---|
| sleep | start time, end time (or "still running"), computed duration, Delete |
| feed | breast L/R ↔ bottle toggle, start, end, oz (bottle only), Delete |
| diaper | wet / dirty / both, time, Delete |
| note | text, time, Delete — **plus** the rows Villie extracted, with group undo |

Delete confirms through `Alert.alert` with a destructive style, matching the
app's existing pattern. There is no undo toast — hard delete is the chosen
posture (D2) and the confirm is the guard.

The note case is the reason for the migration below: with `note_id` populated,
the sheet lists exactly what the parser extracted from that jot and offers
"remove what Villie logged from this" via `deleteNoteExtractions`.

### 7 · Migration 123 — `note_id` linkage

The only schema change. **Next free migration is 123** — remote is at 122
(`mom_tips` took 120–122).

```sql
ALTER TABLE baby_sleep_logs  ADD COLUMN IF NOT EXISTS note_id UUID
  REFERENCES baby_log_notes(id) ON DELETE SET NULL;
ALTER TABLE baby_feed_logs   ADD COLUMN IF NOT EXISTS note_id UUID
  REFERENCES baby_log_notes(id) ON DELETE SET NULL;
ALTER TABLE baby_diaper_logs ADD COLUMN IF NOT EXISTS note_id UUID
  REFERENCES baby_log_notes(id) ON DELETE SET NULL;
```

Plus a change to `supabase/functions/playbook-parse-note/index.ts` to stamp
`note_id` on every row it inserts (it already has `noteId` in scope — it returns
it in the response body).

`ON DELETE SET NULL` so deleting a jot never cascade-deletes real logs the mom
wants to keep. Rows written before this migration keep `note_id = NULL` and
simply don't offer the group-undo affordance.

---

## Month-long simulation

A seed harness proving the design against a realistic month of data, not a
happy-path handful of rows.

**Script:** `scripts/seed-baby-logs.mjs`, invoked via root package scripts
`logs:seed` and `logs:unseed`. Uses `SUPABASE_SERVICE_ROLE_KEY` (following the
existing `specialist-invite.mjs` pattern) so it can insert against a specific
`user_id`.

**Shape of the generated month** — 30 days ending yesterday, tracking the
baby's real week number forward so the data *evolves*:

- wake windows stretching across the month as the baby ages
- naps consolidating — more, shorter naps early; fewer, longer ones later
- cluster feeding in the evening block
- night wakings tapering
- 6–10 diapers a day with a realistic wet/dirty/both mix
- a scattering of free-form notes

**Deliberately seeded failure cases** — these are the point of the exercise:

1. a sleep session left open (forgotten timer) with an absurd elapsed time
2. a second, shorter forgotten timer under the 12h ceiling (tests the
   always-available "ended at…" control rather than the escalated prompt)
3. a duplicate feed logged twice within a minute
4. a breast feed recorded on the wrong side
5. a note whose parsed extraction lands on the wrong day (mis-heard "3")
6. a bottle with a nonsense oz value
7. a day with no logs at all (tests empty-day rendering in History)

**Dry run by default.** The script generates and prints the month it *would*
write — per-type row counts, one fully expanded sample day, and each of the
seven failure cases — and inserts nothing. Writing requires an explicit
`--commit` flag. This is the primary guard against polluting a live account;
the undo file below is the secondary one.

**Undo:** every inserted row id is written to
`scratchpad/seeded-log-ids.json`. `logs:unseed` reads that file and deletes
exactly those ids. Pre-existing real logs are never matched by a date range and
therefore cannot be caught.

**What the simulation must demonstrate:**

- History paging over 30 days performs acceptably and groups days correctly
- Insights' week stepper walks back through four real weeks of data
- the runaway rescue catches case 1 and the always-available control handles
  case 2
- each of cases 3–6 is correctable through the edit sheet
- correcting case 1 visibly moves `avgNapMin` and `avgWakeWindowMin`
- the empty day (case 7) renders as an empty day, not as a gap or a crash

---

## Build sequence

Ordered so each step is independently shippable and the simulation lands early
enough to inform the UI work.

1. **API + store façade** — `LogEntry`, the four `update*` methods,
   `deleteEntry`, `getDay` / `getRange` / `getOpenSessions`, validation, the
   `stopFeed` oz-clearing fix, the bounded open-session window. No UI yet.
2. **Seed harness** — `scripts/seed-baby-logs.mjs` + undo file. Run it. From
   here on, every UI change is developed against a real month of messy data.
3. **Edit sheet + touchable timeline** — extract `LogTimeline`, add
   `LogEditSheet`, make today's rows open it. This alone closes gap 1.
4. **Back-dating** — `TimeChips` in each pane, the finished-bottle path.
   Closes gap 2.
5. **Runaway rescue** — always-available "ended at…", escalated prompt past the
   ceiling. Closes gap 3.
6. **History screen** — `LogHistoryScreen`, "see all →". Closes gap 5.
7. **Migration 123 + `playbook-parse-note` `note_id`** and the note group-undo
   in the edit sheet. Closes gap 4. Last because it is the only step requiring a
   deploy, and it is the least urgent of the six.

## Verification

This repo has **no test harness** — no jest, no vitest, no `test` script.
Verification is therefore:

- `pnpm type-check` and `pnpm lint` clean
- the month-long simulation above, driven in the iOS simulator
- a manual pass on each edit path (sleep, feed, diaper, note) confirming the row
  actually changes in the database, not just in local state
- confirming the Day Sheet (`day-sheet-page`) still renders correctly after logs
  are edited and deleted underneath it

## Risks

- **`getToday`'s open-session window change** alters behavior for any currently
  open session older than 24h. On a real account that session becomes invisible
  in the tracker; it is still reachable through History and the rescue path.
  Worth confirming no user has such a row before deploying.
- **Editing an open session's `started_at` forward past `now()`** would produce a
  negative elapsed time in the live timer. Guarded by the no-future-timestamps
  validation.
- **The seed writes to production.** Mitigated by the exact-row-id undo file, but
  the file must be written *before* the inserts are considered complete, and the
  script must fail loudly rather than silently if it cannot write it.
- **Concurrent sessions share this checkout.** This work lives in the
  `.worktrees/log-editing` worktree on `feat/log-editing`, based on `main`. The
  primary checkout is on `feat/billy-capability-coverage`, which lacks
  migrations 118–122 and cannot `db push`.
