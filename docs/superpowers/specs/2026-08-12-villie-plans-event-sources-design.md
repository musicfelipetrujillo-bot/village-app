# Villie Plans — postpartum source expansion + liveness guard

**Date:** 2026-08-12
**Status:** Approved design, ready for implementation plan
**Scope:** Miami metro. Postpartum-focused event sourcing.

---

## 1. Problem

Villie Plans was empty in production on 2026-08-12. `list_events_near(null, null, 50, null, null)` returned **0 rows**; the most recent approved event started 2026-06-18.

Two causes, one fixed and one open:

**Fixed already (commit `b51a667` on `main`, 2026-08-12).** The `events-harvest` cron line existed only on the unmerged `feat/billy-capability-coverage` branch. GitHub Actions runs `schedule:` triggers **only from the default branch**, so the daily harvest never fired — it ran exactly once, manually, on 2026-08-01. Nothing in Supabase surfaced this: the function was `ACTIVE`, the feed row read `last_sync_status = 'harvested 5/8'`, `consecutive_failures = 0`.

**Open — this spec.** Only one source feed exists (The Underline, a general Miami park). Its programming is generic community content that `ai-event-screen` correctly scores 0.2–0.6, so almost nothing survives. Even running perfectly on schedule, the pipeline yields near-zero publishable events.

## 2. Goal

Make Villie Plans reliably non-empty with postpartum-focused content, and make it report its own failure instead of degrading silently.

**Non-goal:** childbirth-prep and birthing classes. Founder call 2026-08-12 — the target is postpartum activity (postpartum yoga, lactation support, new-mom groups, webinars). Hospital feeds are pointed at their postpartum/lactation/newborn offerings, not their birth-prep catalog.

## 3. What research changed

Candidate sources were verified rather than assumed. The binding constraint is **not** curation — it is page rendering.

`events-harvest` performs a plain `fetch()` → `htmlToText()`. It does not execute JavaScript. Most modern class calendars render client-side.

| Source | Postpartum fit | Harvestable today |
|---|---|---|
| PSI online support meetings | Excellent — free, virtual, postpartum-specific | Yes — schedules in static HTML |
| The Underline | Weak (general park) | Yes |
| `events.baptisthealth.com` | Excellent | No — hash-routed SPA (`#/calendar`) |
| `baptisthealth.net/services/maternity/classes-and-education` | Good | Barely — phone directory, one recurring item |
| Miami-Dade Library (`mdpls.org/events`) | Good — includes an infant-massage class run by South Miami Hospital staff | No — client-rendered listing |
| The One Tribe, Baby & Me yoga (Miami 33137) | Excellent | No — schedule behind a JS booking widget |

Registering curated URLs without addressing rendering produces a roughly two-source plan, most of it off-target.

## 4. Silent-failure modes found

Four distinct ways Villie Plans fails without anyone noticing. The cron bug was the first; three remain in `events-harvest`.

1. **Cron never fires** (fixed) — schedule lived off the default branch.
2. **Zero-yield reads as healthy.** After a non-throwing run the function unconditionally sets `consecutive_failures: 0`. A JS-rendered page returns HTTP 200, extracts nothing, and records `harvested 0/0` with a clean failure counter — permanently healthy, permanently producing nothing.
3. **Missing `ends_at` drops the event.** `events.ends_at` is `NOT NULL`, and `upsert_ingested_event` passes `p_ends_at` through without a default. The extraction prompt emits `null` when a page shows no end time, so the insert fails and the row is skipped with only a `console.error`. This is what `harvested 5/8` was: 3 of 8 events lost on the first run, ~37%.
4. **Feeds self-deactivate quietly.** `if (failures >= 3) patch.is_active = false;` — a venue site redesign disables a feed with no alert.

## 5. Design

### 5.1 Harvester fixes (`supabase/functions/events-harvest/index.ts`)

**Render fallback.** Attempt the direct fetch first — it is cheap and works for PSI and The Underline. When extraction yields zero events, retry the page through a JS-rendering text proxy and re-extract. Automatic fallback is preferred over a per-feed configuration flag: it needs no registry schema change and has no third state to get wrong.

Order matters, since the render fallback and the failure counter share the same trigger. Per feed, per run:

```
direct fetch → extract
  found > 0            → success; reset consecutive_failures
  found = 0            → retry via render proxy → re-extract
      found > 0        → success; reset consecutive_failures
      found = 0        → increment consecutive_failures; status 'yielded 0'
  fetch/parse threw    → increment consecutive_failures; status 'error: …'
```

The counter is incremented only after the fallback has also come back empty, so a JS-rendered page that the proxy rescues is never penalized.

**`ends_at` default.** When the page provides no end time, set `ends_at = starts_at + 90 minutes` rather than passing `null`. Applied in the edge function, not the RPC, so other ingest paths keep their current contract.

**Zero-yield counts as failure.** Only reset `consecutive_failures` when `found > 0` — see the ordering above. When both the direct fetch and the render fallback come back empty, increment it and record `last_sync_status = 'yielded 0'`. The existing `failures >= 3 → is_active = false` rule then retires genuinely dead sources, and §5.4 makes that visible.

**Webinar plumbing.** When `feed.default_event_type = 'webinar'`, map the extracted `event_url` to `p_stream_url` instead of appending it to the description, and set `platform` accordingly. `p_stream_url` is currently hardcoded `null`.

Virtual events matter disproportionately here. `list_events_near` short-circuits the distance filter for them:

```sql
AND (
  e.type = 'webinar'
  OR p_lat IS NULL OR p_lng IS NULL
  OR ST_DWithin(e.location, ..., p_radius_km * 1000)
)
```

A webinar reaches every user regardless of location and sorts first. No RPC change needed.

### 5.2 Probe mode

New `{probe: {url, timezone?}}` branch in `events-harvest`: fetch, render-fallback, extract, and **return** the parsed events without inserting anything or touching the registry.

This makes curation verifiable. Every candidate source is probed before registration, so a dead or JS-only URL is caught in seconds rather than discovered weeks later as an empty tab. It is also the regression tool when a venue redesigns its site.

### 5.3 Tiered source set

Registration uses the existing `register` mode — no migration:

```json
{"register": {"partner_name": "...", "url": "...", "city": "Miami",
              "timezone": "America/New_York", "age_tags": ["0-3mo","3-6mo","6-12mo"]}}
```

`register` hardcodes `auto_publish_threshold: 1.0`; tier A and B feeds get a follow-up `UPDATE` to 0.75.

| Tier | Threshold | Behavior | Candidates |
|---|---|---|---|
| **A — clinical / hospital postpartum** | 0.75 | Auto-publishes | ⚠️ **No harvestable Miami hospital calendar found — see below.** South Miami Hospital's lactation group (first Friday monthly) is the only dated item, and it lives on a phone-directory page. Nicklaus Children's unverified. |
| **B — postpartum-specific + virtual** | 0.75 | Auto-publishes | PSI online support meetings (virtual, verified), The One Tribe Baby & Me (Miami 33137), La Leche League South Florida |
| **C — general stroller-friendly** | 1.0 | Always manual review | The Underline (existing), Miami-Dade Library baby lapsit + infant massage, Miami-Dade Parks |

The final list is whatever passes the probe. Candidates above are researched but only PSI and The Underline are confirmed harvestable as-is; the rest depend on the render fallback.

**⚠️ Correction, 2026-08-12 — `events.baptisthealth.com` is the WRONG ORGANIZATION.** An earlier draft of this spec listed it as the Tier-A hospital source. Tested through the render proxy, it returns dated events for **Corbin and Richmond, Kentucky** — it belongs to Baptist Health Kentucky/Indiana, not Baptist Health *South Florida* (`baptisthealth.net`). "Baptist Health" names several unrelated systems (Kentucky, Jacksonville, Pensacola, San Antonio). Registering it would have fed Kentucky childbirth classes into a Miami app, in the one category the founder explicitly excluded. Baptist Health South Florida publishes no dated calendar at all — `/services/maternity/classes-and-education` is a phone-and-email directory whose only extractable item is a monthly lactation support group. **Treat every hospital "events" domain as guilty until the probe proves both the market and the dates.**

**What the render proxy actually unlocks** (measured, not assumed): **The One Tribe** (Miami 33137, Baby & Me + postnatal yoga) renders a real dated schedule — `Thursday, August 13, 2026` / `1:00 PM` — and is the strongest Tier-B candidate. The Miami-Dade Library calendar did **not** render at `mdpls.libnet.info/events?r=thismonth` (3.4KB of ADA boilerplate); it needs a different endpoint before it is worth registering.

Tier A/B at 0.75 sits above the 0.55 auto-reject floor and below the 1.0 cap, so on-mission content from trusted sources publishes without a manual tap while general community content still queues for review. This is the founder decision from 2026-08-12: tiered trust, chosen so the tab's health does not depend on clearing a weekly queue.

Feeds carry `default_age_tags` of `['0-3mo','3-6mo','6-12mo']` — excluding `pregnancy` — to match the postpartum focus.

### 5.4 Liveness guard

Extend `gear-moderation-daily-digest` (already scheduled 13:00 UTC daily, already wired to Resend) with a Villie Plans block:

- approved + upcoming event count — the number that was 0 and triggered this work
- pending review queue depth
- any feed with `consecutive_failures > 0` or `is_active = false`
- any feed whose last run yielded zero events

Reusing the digest was chosen over a new alert path: no new infrastructure, and it lands in a mailbox already being read.

## 6. Out of scope

~~**ZIP → coords fallback and a 10-mile default radius.**~~ **DONE 2026-08-12** — pulled in on founder instruction rather than deferred. `getEffectiveCoords` now falls back to the mother's own ZIP centroid before the launch-market default; migration 117 adds a `zip_centroids` cache + `get_zip_coords`, the new `geocode-zip` edge function fills it on demand from Google (cache-first, one lookup per ZIP ever), and `useUserStore.resolveZipCoords()` warms it once per session so all six existing call sites stay synchronous and unchanged. Default radius moved 25 → 10 in **both** the client constant and the `users.search_radius_miles` column default (changing only one would have made it a no-op), with existing rows migrated off the old default. Verified safe first: from 33133, 10mi still covers 10 of 11 specialists and 8 of 8 active gear listings.

**Rubric retune.** `ai-event-screen`'s prompt already encodes a 2026-07-31 founder call scoring stroller-friendly community events at 0.6. Revisit weighting toward postpartum-over-prenatal only if tier B yield disappoints; changing it now would confound the source-expansion results.

## 7. Success criteria

1. `list_events_near(null, null, 50, null, null)` returns > 0 rows and stays non-zero across a week of unattended daily runs.
2. At least one tier A or B source auto-publishes a postpartum event with no manual action.
3. A deliberately broken feed URL surfaces in the next daily digest.
4. Probe mode returns parsed events for a JS-rendered page that currently yields zero.
5. An event page with no stated end time is ingested rather than dropped.

## 8. Risks

- **Third-party render proxy in the data path.** Adds an external dependency and a rate limit. Mitigated by trying direct fetch first, so only JS-rendered sources depend on it.
- **Auto-publish at 0.75 puts unreviewed content in front of moms.** Bounded to hand-vetted tier A/B sources; the existing review surface can retract anything.
- **Harvesting hospital pages uninvited.** Founder decision 2026-08-12 — listings drive moms to the hospital's own registration page, and it doubles as a GTM opener. Feeds are per-source deactivatable if any partner objects.
- **Page-scraping is inherently brittle.** This is why §5.4 exists; brittleness is accepted and made visible rather than engineered away.
