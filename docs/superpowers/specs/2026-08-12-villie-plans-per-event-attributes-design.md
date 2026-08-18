# Villie Plans — per-event price and format

**Date:** 2026-08-12
**Status:** ✅ **IMPLEMENTED 2026-08-17** — shipped on `main`, deployed to prod. One verification gate still open (see §9).
**Follows:** `2026-08-12-villie-plans-event-sources-design.md`

---

## 1. Problem

Four researched postpartum sources probed clean and were rejected, costing ~44 events:

| Source | Yield | Blocker |
|---|---|---|
| Postpartum Support Virginia | 19 | In-person Virginia events ("Stroller Struts (Virginia Beach)") |
| Postpartum Health Alliance | 15 | Mixes free with $30–$480; some CA-residents-only |
| The Motherhood Center | 6 | Entirely ticket-based |
| Postpartum Resource Center NY | 4 | Mixes free with $40/$50, plus in-person NY |

The common shape: **one page carries a mix, and a feed is all-or-nothing.** Two feed-level defaults are applied to every event a source produces, and neither can be right for a mixed page:

- **`upsert_ingested_event` hardcodes `is_free: TRUE`.** Registering a paid source advertises paid groups as free.
- **`events_partner_feeds.default_event_type` is one value.** Set a mixed feed to `webinar` and in-person events become fake webinars; set it to `local` and virtual events land on the Null-Island sentinel.

Neither problem is about finding postpartum organizations — there are plenty. It is that most regional nonprofits publish free and paid, virtual and in-person, on a single page.

**Correcting an earlier claim:** price extraction alone does *not* unlock all four. It fully unlocks only The Motherhood Center. The rest need format handled too. This spec covers both.

## 2. Goal

Let each harvested event carry its own price and its own format, so a mixed-source page can be registered without lying to a mother about either.

**Non-goal:** filtering out-of-market events with new logic. §5.2 explains why the existing radius filter already does this once format is correct.

## 3. Design

### 3.1 Extract price per event

Extend the extraction schema in `events-harvest`:

```
"cost": "free" | "paid" | "unknown",
"price_cents": number | null      // only when cost = "paid" and a figure is stated
```

Prompt rules:

- `free` only when the page **says so** — "free", "no cost", "complimentary", "donation based", "pay what you can". Donation-based counts as free: nobody is turned away, and it is the posture PSI and LLL already use.
- `paid` when any figure or ticket requirement appears. Capture the lowest stated figure when a range is given ("$30 a class, 4 for $90" → 3000).
- `unknown` when the page is silent. **This is a real value, not a fallback** — the whole defect being fixed is that silence currently reads as "free".
- Sliding scale or insurance-determined → `paid` with `price_cents: null`. She should expect to pay something even if we can't say how much.

### 3.2 Extract format per event

```
"format": "in_person" | "virtual" | "unknown"
```

- `virtual` on Zoom/online/webinar/"virtual" signals.
- `in_person` when a physical venue or address is given.
- `unknown` → fall back to the feed's `default_event_type`, preserving today's behavior for single-format sources (PSI, LLL, The Underline are unaffected).

Per-event format overrides `feed.default_event_type`. That is the change that makes a mixed page registerable.

### 3.3 Write-through

In the `upsert_ingested_event` call:

| Field | Value |
|---|---|
| `p_type` | `'webinar'` when format resolves virtual, `'local'` when in-person |
| `p_is_free` | `true` only when `cost === 'free'`; otherwise `false` |
| `p_price_cents` | the extracted figure, or null |

`upsert_ingested_event` needs two new parameters (`p_is_free`, `p_price_cents`); it currently hardcodes `TRUE` for `is_free` and never sets `price_cents`. Both columns already exist on `events` — `is_free BOOLEAN NOT NULL DEFAULT true`, `price_cents INTEGER NULL` — so **no schema change is required**, only a function signature change. Existing callers (`events-ingest-ics`) keep current behavior via parameter defaults.

### 3.4 Review gating

Two founder decisions, 2026-08-12:

**A known price never auto-publishes.** Regardless of screening confidence or feed threshold, `cost === 'paid'` forces `review_status = 'pending'`. A postpartum mother clicking through to a $300 program deserves a human to have looked first.

**Unknown price forces review too.** `cost === 'unknown'` also pins to `pending`. This is the direct fix for the defect: we never tell her something is free when we don't know. It costs a few queue items on sources that omit pricing, which is the correct trade.

Auto-publish therefore narrows to: **free, screened above the feed threshold.** Everything currently live (PSI, all three LLL feeds) is explicitly free and unaffected.

**Where the gate lives.** In `ai-event-screen`, not `events-harvest`. Every harvested row is inserted `pending` by `upsert_ingested_event` regardless; it is the screener that promotes to `approved`. A gate at upsert time would therefore do nothing. After the screener computes confidence, it applies:

```
if (!row.is_free) nextStatus = 'pending'   // paid or unknown: never auto-approve
```

This reads a boolean already on the row — it does not ask the model to reason about money, so the screener's job stays "judge maternal relevance" and the commercial policy stays a deterministic check on top. Paid events still get scored, so they arrive in the queue with a confidence and rationale attached rather than as unreviewed unknowns.

Because §3.3 sets `is_free = true` only for `cost === 'free'`, this single condition covers both `paid` and `unknown`. The two are still distinguishable downstream by `price_cents` and the ingestion note.

### 3.5 Display

`EventDetailScreen` and the event card already read `is_free` / `price_cents`. Two combinations are new and must be checked during implementation:

| State | `is_free` | `price_cents` | Must render as |
|---|---|---|---|
| Free | `true` | null | "Free" (unchanged) |
| Paid, figure known | `false` | e.g. `3000` | "$30" |
| Paid or price unstated | `false` | `null` | Something honest — "See details for pricing" |

The third row is the risk: `false` + `null` must not fall through to "$0.00", "Free", or a blank. This is the only client-side surface in the change and the one a mother would actually act on.

## 4. What this unlocks

| Source | After this change |
|---|---|
| The Motherhood Center | Registerable. All 6 virtual, priced, queued for review. |
| Postpartum Health Alliance | Registerable. Free groups auto-publish; the $30–$480 ones queue. ⚠️ Residency limits (some CA-only) are **not** solved here — see §6. |
| Postpartum Resource Center NY | Registerable. Free virtual auto-publish; in-person NY typed `local` and filtered by distance. |
| Postpartum Support Virginia | Registerable. In-person VA events become `local` in Virginia Beach and drop out of a Miami radius on their own. |

## 5. Why no new filtering logic

### 5.1 Price
Already modeled. `events.is_free` and `price_cents` exist and are read by the client; only the write path is wrong.

### 5.2 Geography
`list_events_near` filters `local` events by `ST_DWithin` and exempts `webinar` from distance entirely. A Virginia Beach event typed `local` with a real address gets geocoded by the existing `events-geocode` sweep and then simply falls outside a Miami mother's radius — now 10 miles. No allowlist, no per-feed region rules. **Correct typing is the filter.** This is why §3.2 matters more than §3.1 despite price being the headline.

## 6. Out of scope

**Residency and eligibility restrictions.** Postpartum Health Alliance's "only open to CA residence" is neither a price nor a format — it is an eligibility rule stated in prose. Nothing here detects it. A California-only virtual group would auto-publish to a Miami mother if it is free and screens well. Options, deferred until a source actually needs it: extract an `eligibility_note` and force review when non-empty, or keep such feeds at threshold 1.0. Flagged because it is the one way this design can still mislead someone.

**Currency.** `price_cents` is assumed USD, matching every current and candidate source.

## 7. Success criteria

1. A source page mixing free and paid ingests with per-event `is_free` matching the page.
2. A page mixing virtual and in-person produces both `webinar` and `local` rows from one feed.
3. An in-person out-of-market event does not appear in `list_events_near` from a Miami origin at 10 miles.
4. A paid event never reaches `approved` without a human, regardless of confidence.
5. An event whose page states no price lands `pending`, not `approved`.
6. PSI and the three LLL feeds re-harvest with identical results — free, virtual, auto-published.
7. A paid event renders an honest price on the detail screen — never "$0.00" or blank.

## 8. Risks

- **Extraction is now load-bearing for a money claim.** A misread turns a paid class into a free one on the card. Mitigated by `unknown` defaulting to review rather than to free, so the failure mode is a queue item instead of a wrong promise.
- **Queue growth.** Mixed sources will add review items. That is the intended cost of not lying about price; if it becomes a burden, the lever is dropping the source, not loosening the gate.
- **Regression surface on healthy feeds.** All four live feeds flow through the changed code path. Criterion 6 exists to catch that specifically.
- **`upsert_ingested_event` is shared with `events-ingest-ics`.** The signature change must default to today's behavior so the ICS path is untouched.

## 9. Implementation record (2026-08-17)

Everything landed **directly on `main`**, not via the plan's branch — see "Why the branch was abandoned" below.

| Task | Commit | State |
|---|---|---|
| 1 — price through `upsert_ingested_event` | migrations 118 + 119 | ✅ applied |
| 2 — extract `cost` / `format` per event | `bfeb943`, `d1645b7` | ✅ |
| 3 — write price + per-event type through | `76e7418` → `a3b7f5f` on main | ✅ shipped & deployed · ⛔ **live gate not run** |
| 4 — never auto-publish what isn't known free | `ea6076d` | ✅ |
| 5 — honest price on `EventDetailScreen` | `b1b2353` | ✅ |
| 6 — land + document | this section | ✅ |

**Verified.** `tsc --noEmit` exits 0. `eventCost()` and the harvester's failure classifier were each extracted from their shipped source, compiled, and run against the spec's cases plus hostile inputs (zero / negative / NaN price; infra-vs-feed error shapes) — all passing, with an explicit assertion that no input can render `$0.00`. EN/ES i18n parity is exact across the whole file. Against production: `is_free` defaults `true`, so ICS events are untouched, and **0 of 42** approved events were held by the new gate — criterion 6 satisfied.

**The one gate that has not run.** Criteria 1–3 need a live harvest against a mixed source, and the harvester has been unable to reach Anthropic since the account's credit lapsed. When credit is restored: `POST {}` to `events-harvest`, confirm `upserted == found` and `skipped == 0` on the four free feeds, then re-run §7's assertions. Note that criterion `paid_total > 0` **cannot** be satisfied until a genuinely paid or price-silent source is registered — as of 2026-08-17 every live event is `is_free = true`, so the gate has never actually fired in production.

**Why the branch was abandoned.** `feat/plans-per-event-attributes` was cut from an older `main`. Merging it would have deleted ~1,900 lines of since-shipped work — `MomTipsScreen`, `ResetRechargeScreen`, `momTips.ts`, `comfortAudio.ts`, and migrations 120/121/122. That is the same stale-base failure that made migration 118 revert 048's cross-feed dedup. Only the files that genuinely needed to move were carried across. **Do not merge that branch.**

**Two production faults found while verifying this work**, both fixed:

1. **`main` was 82 lines behind the deployed harvester** (`a3b7f5f`). This repo deploys the *working tree*, so a `functions deploy` from `main` would have silently reverted the live extractor — restoring the "everything advertises as free" defect this spec exists to remove.
2. **All five feeds had auto-retired** (`ebdca3e`). The credit lapse made every nightly harvest throw; three runs tripped `failures >= 3 → is_active = false` on all five at once. Deactivation is sticky, so restoring credit would *not* have revived the tab. `consecutive_failures` now counts only failures the feed actually caused — billing, auth, rate-limit and Anthropic 5xx are recorded but never retire a source. Feeds were reactivated the same day.
