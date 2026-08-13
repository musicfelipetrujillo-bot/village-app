# Villie Plans — Per-Event Price and Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each harvested event carry its own price and its own format, so a source page that mixes free with paid, or virtual with in-person, can be registered without misinforming a mother about either.

**Architecture:** `events-harvest` extracts `cost` and `format` per event. Format resolves each event's `type` (falling back to the feed default), which lets the existing geocode + radius filter drop out-of-market in-person events with no new filtering code. Price writes through two new `upsert_ingested_event` parameters. `ai-event-screen` gains a deterministic gate: anything not known-free stays `pending` regardless of confidence.

**Tech Stack:** Supabase Postgres (plpgsql RPC), Deno edge functions, Anthropic Haiku 4.5 for extraction, React Native + Expo client, hand-rolled EN/ES i18n.

**Spec:** `docs/superpowers/specs/2026-08-12-villie-plans-per-event-attributes-design.md`

---

## Testing approach — read before Task 1

This repo has **no test framework**: no jest, no test files, no `test` script in any `package.json`. Do not add one — that is a larger decision than this feature.

The verification loop used throughout this plan is the repo's real one:

| Tool | Command | Used for |
|---|---|---|
| Probe mode | `POST /functions/v1/events-harvest {"probe":{"url":"…"}}` | Extraction behavior against a real page, writes nothing |
| SQL assertion | `supabase` MCP `execute_sql`, or `curl` to `/rest/v1/` | Row-level truth in prod |
| Typecheck | `npx tsc --noEmit -p apps/mobile/tsconfig.json` | Client changes |
| Parse check | `npx esbuild <fn> --bundle --external:npm:* --external:jsr:* --outfile=/dev/null` | Edge function syntax before deploy |

The TDD discipline still holds: every task states the check, you run it and watch it fail, then implement, then run it again and watch it pass.

**Environment setup, once per session:**

```bash
cd "/Users/gp/The Village App/village-app"
set -a && . apps/mobile/.env && set +a
# Gives you $EXPO_PUBLIC_SUPABASE_URL and $SUPABASE_SERVICE_ROLE_KEY
```

**Two repo hazards that will bite you:**

1. **`supabase functions deploy` bundles the WORKING TREE, not HEAD.** Deploying from a dirty tree silently ships uncommitted code. Run `git status --short -- supabase/functions/<name>` before every deploy.
2. **The primary checkout is shared with other Claude sessions and is NOT on `main`.** Never `git checkout`. Commit via a detached worktree:

```bash
WT=/tmp/wt-$$ && git fetch origin main --quiet && git worktree add --detach "$WT" origin/main
cp <changed files> "$WT/<same paths>"
cd "$WT" && git add -A && git commit -m "..." && git push origin HEAD:main
cd - && git worktree remove "$WT" --force
```

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `supabase/migrations/118_event_price_passthrough.sql` | Adds `p_is_free` + `p_price_cents` to `upsert_ingested_event`, defaulted so `events-ingest-ics` is untouched | Create |
| `supabase/functions/events-harvest/index.ts` | Extract `cost` + `format` per event; resolve type; pass price through | Modify |
| `supabase/functions/ai-event-screen/index.ts` | Deterministic gate: not-known-free never auto-approves | Modify |
| `apps/mobile/src/i18n/en.json` · `es.json` | Cost row copy | Modify |
| `apps/mobile/src/screens/events/EventDetailScreen.tsx` | Render the cost row | Modify |

No schema change: `events.is_free` (`NOT NULL DEFAULT true`) and `events.price_cents` (nullable) already exist.

---

### Task 1: Pass price through `upsert_ingested_event`

**Files:**
- Create: `supabase/migrations/118_event_price_passthrough.sql`

- [ ] **Step 1: Confirm 118 is actually free**

The migration number moves when other sessions land work. Run:

```bash
cd "/Users/gp/The Village App/village-app" && /bin/ls supabase/migrations/ | tail -3
```

Then check the remote:

```sql
select version from supabase_migrations.schema_migrations order by version desc limit 3;
```

Expected: highest is `117`. If it is not, rename the file in this task to `<highest+1>_event_price_passthrough.sql` and use that number everywhere below.

- [ ] **Step 2: Write the check that fails**

```bash
cd "/Users/gp/The Village App/village-app" && set -a && . apps/mobile/.env && set +a
/usr/bin/curl -sS "${EXPO_PUBLIC_SUPABASE_URL}/rest/v1/rpc/upsert_ingested_event" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" -d '{"p_is_free": false}'
```

Expected now: an error naming `p_is_free` as an unknown argument (PostgREST `PGRST202`), because the parameter does not exist yet. This confirms the gap.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/118_event_price_passthrough.sql`:

```sql
-- 118_event_price_passthrough.sql
--
-- Adds price pass-through to upsert_ingested_event.
--
-- WHY: the function hardcodes is_free = TRUE for every ingested event. Four
-- researched postpartum sources were rejected because their pages mix free
-- with paid ($30-$480) groups, and registering them would have advertised
-- paid programs as free. See
-- docs/superpowers/specs/2026-08-12-villie-plans-per-event-attributes-design.md
--
-- Both columns already exist on `events` (is_free BOOLEAN NOT NULL DEFAULT
-- true, price_cents INTEGER NULL), so this is a signature change only.
--
-- The two new parameters are LAST and DEFAULTED to today's behavior, so the
-- existing caller `events-ingest-ics` keeps working untouched.
--
-- ⚠️ The DROP below is REQUIRED, not tidiness. `CREATE OR REPLACE FUNCTION`
-- only replaces a function with the SAME argument list. Adding two parameters
-- creates a second, OVERLOADED function, and every existing 19-argument call
-- then fails with "function is not unique" because the 21-arg version's
-- defaults make it equally applicable. This repo has already been bitten by
-- the same class of bug (see migration 023 / get_gear_listing).
DROP FUNCTION IF EXISTS upsert_ingested_event(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ,
  TEXT, TEXT[], TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION upsert_ingested_event(
  p_source_feed_id UUID,
  p_source_uid TEXT,
  p_type TEXT,
  p_title TEXT,
  p_description TEXT,
  p_host_name TEXT,
  p_host_avatar_url TEXT,
  p_is_partner BOOLEAN,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_timezone TEXT,
  p_age_tags TEXT[],
  p_venue_name TEXT,
  p_address TEXT,
  p_city TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_stream_url TEXT,
  p_platform TEXT,
  p_is_free BOOLEAN DEFAULT TRUE,
  p_price_cents INTEGER DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_id UUID;
  v_geo GEOGRAPHY(Point, 4326);
  v_needs_geocode BOOLEAN := FALSE;
BEGIN
  IF p_type = 'local' THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      -- Null-Island sentinel until events-geocode resolves the address.
      v_geo := ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography;
      v_needs_geocode := TRUE;
    ELSE
      v_geo := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
    END IF;
  END IF;

  INSERT INTO events (
    type, title, description, host_name, host_avatar_url,
    is_partner, is_third_party,
    starts_at, ends_at, timezone, age_tags,
    venue_name, address, city, location, needs_geocode,
    stream_url, platform,
    is_free, price_cents, status, review_status,
    source_feed_id, source_uid, source_synced_at
  ) VALUES (
    p_type, p_title, p_description, p_host_name, p_host_avatar_url,
    p_is_partner, TRUE,
    p_starts_at, p_ends_at, p_timezone, COALESCE(p_age_tags, '{}'),
    p_venue_name, p_address, p_city, v_geo, v_needs_geocode,
    p_stream_url, p_platform,
    p_is_free, p_price_cents, 'upcoming', 'pending',
    p_source_feed_id, p_source_uid, now()
  )
  ON CONFLICT (source_feed_id, source_uid)
  WHERE source_feed_id IS NOT NULL AND source_uid IS NOT NULL
  DO UPDATE SET
    type             = EXCLUDED.type,
    title            = EXCLUDED.title,
    description      = EXCLUDED.description,
    host_name        = EXCLUDED.host_name,
    host_avatar_url  = EXCLUDED.host_avatar_url,
    is_partner       = EXCLUDED.is_partner,
    starts_at        = EXCLUDED.starts_at,
    ends_at          = EXCLUDED.ends_at,
    timezone         = EXCLUDED.timezone,
    -- Don't clobber location, age_tags, or needs_geocode on update —
    -- they may have been improved by events-geocode / ai-event-screen.
    venue_name       = EXCLUDED.venue_name,
    address          = EXCLUDED.address,
    city             = COALESCE(events.city, EXCLUDED.city),
    stream_url       = EXCLUDED.stream_url,
    platform         = EXCLUDED.platform,
    -- Price DOES refresh on re-harvest: if a venue starts charging for a
    -- previously free group, the card must stop saying "Free".
    is_free          = EXCLUDED.is_free,
    price_cents      = EXCLUDED.price_cents,
    source_synced_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_ingested_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_ingested_event TO service_role;
```

- [ ] **Step 4: Apply it**

```bash
cd "/Users/gp/The Village App/village-app" && /opt/homebrew/bin/supabase db push --linked --yes
```

Expected: `Applying migration 118_event_price_passthrough.sql...` then `Finished supabase db push.`

If it errors with **"Remote migration versions not found in local migrations directory"**, a remote-applied migration is missing locally. Do **not** run `supabase migration repair` — it rewrites shared history. Find the missing `.sql` (check `git show origin/main:supabase/migrations/<n>_*.sql` and any `.worktrees/*`), copy it into `supabase/migrations/`, re-run the push, then remove the copy if it is not yours to commit.

- [ ] **Step 5: Run the check from Step 2 again**

Expected: no longer `PGRST202`. A different error about other missing required arguments is **success** — it proves `p_is_free` is now a recognized parameter.

- [ ] **Step 6: Verify exactly ONE function exists, with 21 args**

This is the step that catches the overload trap. Two rows here means the DROP did not match and `events-ingest-ics` is now broken.

```sql
select p.oid::regprocedure as signature, p.pronargs as arg_count,
       p.pronargdefaults as defaulted
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'upsert_ingested_event';
```

Expected: **exactly one row**, `arg_count = 21`, `defaulted = 2`.

If two rows come back, drop the 19-argument one explicitly using the signature the query printed, then re-run.

- [ ] **Step 6b: Prove the 19-argument call path still resolves**

`events-ingest-ics` calls with 19 arguments and must keep working. Simulate it against a throwaway feed id that cannot match anything:

```sql
select upsert_ingested_event(
  '00000000-0000-0000-0000-000000000000'::uuid, 'plan-smoke-test', 'webinar',
  'Plan smoke test', 'temporary row', 'test', null, false,
  now() + interval '30 days', now() + interval '30 days 1 hour',
  'America/New_York', '{}'::text[], null, null, 'Online', null, null,
  'https://example.com/join', 'other'
) as new_id;
```

Expected: returns a UUID with no "function is not unique" error. Then confirm the default applied and clean up:

```sql
select is_free, price_cents from events where source_uid = 'plan-smoke-test';
delete from events where source_uid = 'plan-smoke-test';
```

Expected: `is_free = true`, `price_cents = null` — proving the defaults preserve today's behavior for the ICS caller. The delete must run; leaving the row would put a fake event in the tab.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/118_event_price_passthrough.sql
git commit -m "feat(plans): pass price through upsert_ingested_event

is_free was hardcoded TRUE for every ingested event, so any source mixing
free and paid programs would have advertised paid ones as free. Both columns
already existed on events; this is a signature change only. New params are
last and defaulted so events-ingest-ics is untouched. Price refreshes on
re-harvest so a group that starts charging stops saying Free."
```

---

### Task 2: Extract `cost` and `format` per event

**Files:**
- Modify: `supabase/functions/events-harvest/index.ts` (the `EXTRACT_SYSTEM` prompt and the `HarvestedEvent` interface)

- [ ] **Step 1: Write the check that fails**

The Motherhood Center is entirely ticket-based and entirely virtual — a clean signal source.

```bash
cd "/Users/gp/The Village App/village-app" && set -a && . apps/mobile/.env && set +a
/usr/bin/curl -sS -X POST "${EXPO_PUBLIC_SUPABASE_URL}/functions/v1/events-harvest" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Content-Type: application/json" \
  -d '{"probe":{"url":"https://themotherhoodcenter.com/support-groups/"}}' --max-time 200 \
  | /usr/bin/python3 -c "
import sys,json
d=json.load(sys.stdin)
for e in (d.get('events') or [])[:4]:
    print(e['title'][:40], '| cost=', e.get('cost'), '| format=', e.get('format'))
"
```

Expected now: every row prints `cost= None | format= None` — the fields do not exist yet.

- [ ] **Step 2: Extend the extraction interface**

In `supabase/functions/events-harvest/index.ts`, replace the `HarvestedEvent` interface:

```ts
interface HarvestedEvent {
  title: string; description: string; starts_at: string; ends_at: string | null;
  venue_name: string | null; address: string | null; event_url: string | null;
  cost: 'free' | 'paid' | 'unknown';
  price_cents: number | null;
  format: 'in_person' | 'virtual' | 'unknown';
}
```

- [ ] **Step 3: Extend the prompt**

In the same file, in `EXTRACT_SYSTEM`, replace the JSON element block so it reads:

```
{
  "title": string,                       // exact event name from the page
  "description": string,                 // <=350 chars, faithful to the page — no invention
  "starts_at": string,                   // ISO 8601 WITH the utc offset for the venue timezone you are given
  "ends_at": string | null,              // ISO 8601 or null if the page gives no end
  "venue_name": string | null,
  "address": string | null,              // street address if shown, else null
  "event_url": string | null,            // the event's own detail/ticket link from [link: ...] markers, absolute URL
  "cost": "free" | "paid" | "unknown",
  "price_cents": number | null,          // only when cost is "paid" AND a figure is stated. 30 dollars -> 3000
  "format": "in_person" | "virtual" | "unknown"
}
```

Then append these rules to the `HARD RULES:` list, immediately before the `- Max 20 events.` line:

```
- "cost": say "free" ONLY when the page says so — free, no cost, complimentary,
  donation based, pay what you can. Donation-based counts as free: nobody is
  turned away. Say "paid" when any figure or ticket purchase is mentioned; with
  a range, use the LOWEST stated figure ("$30 a class, 4 for $90" -> 3000).
  Sliding scale or "determined by insurance" is "paid" with price_cents null.
  Say "unknown" when the page simply does not mention cost. Do NOT guess free.
- "format": "virtual" for Zoom/online/webinar/virtual signals, "in_person" when
  a physical venue or street address is given, "unknown" when neither is clear.
```

- [ ] **Step 4: Parse-check and deploy**

```bash
cd "/Users/gp/The Village App/village-app"
npx --yes esbuild@0.23.0 supabase/functions/events-harvest/index.ts --loader:.ts=ts --bundle "--external:npm:*" "--external:jsr:*" --format=esm --outfile=/dev/null
git status --short -- supabase/functions/events-harvest/
/opt/homebrew/bin/supabase functions deploy events-harvest --project-ref albyndcruwopulazvpjs
```

Expected: esbuild prints a size and `Done`; `git status` shows only your intended modification; deploy prints `Deployed Functions on project albyndcruwopulazvpjs: events-harvest`.

- [ ] **Step 5: Run the check from Step 1 again**

Expected: rows print `cost= paid` and `format= virtual`. The Motherhood Center states ticket purchase and says "All support groups at The Motherhood Center are virtual."

- [ ] **Step 6: Verify a known-free source still reads free**

```bash
/usr/bin/curl -sS -X POST "${EXPO_PUBLIC_SUPABASE_URL}/functions/v1/events-harvest" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Content-Type: application/json" \
  -d '{"probe":{"url":"https://www.postpartum.net/get-help/psi-online-support-meetings/"}}' --max-time 200 \
  | /usr/bin/python3 -c "
import sys,json
d=json.load(sys.stdin)
for e in (d.get('events') or [])[:4]:
    print(e['title'][:40], '| cost=', e.get('cost'), '| format=', e.get('format'))
"
```

Expected: `cost= free` (PSI's page says "100% free forever") and `format= virtual`. If PSI reads `unknown`, the prompt's free-signal list is too narrow — widen it before continuing, because PSI is live and must keep auto-publishing.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/events-harvest/index.ts
git commit -m "feat(plans): extract cost and format per event

Adds cost (free/paid/unknown), price_cents and format (in_person/virtual/
unknown) to the extraction schema. 'unknown' is a real value, not a fallback —
silence about price currently reads as free, which is the defect being fixed.
Donation-based counts as free; a range takes the lowest figure."
```

---

### Task 3: Write price and per-event type through

**Files:**
- Modify: `supabase/functions/events-harvest/index.ts` (inside `harvestFeed`)

- [ ] **Step 1: Write the check that fails**

```sql
select count(*) as paid_rows from events where is_free = false;
```

Expected now: `0`. Nothing in the table has ever been marked paid.

- [ ] **Step 2: Resolve per-event format**

In `harvestFeed`, find this line:

```ts
    const streamUrl = isWebinar ? (ev.event_url ?? url) : null;
```

Replace it and the `venueName` line that follows with:

```ts
    // Per-event format overrides the feed default. This is what makes a page
    // mixing virtual and in-person registerable: an in-person event elsewhere
    // becomes a 'local' row with a real address, gets geocoded by the existing
    // sweep, and then falls outside a Miami mother's radius on its own. Correct
    // typing IS the geographic filter — no extra filtering logic exists or is
    // needed. 'unknown' keeps today's behavior for single-format feeds.
    const eventIsWebinar = ev.format === 'virtual' ? true
      : ev.format === 'in_person' ? false
      : isWebinar;
    const streamUrl = eventIsWebinar ? (ev.event_url ?? url) : null;
    // The hosting org is a truthful venue when the page names no other.
    const venueName = ev.venue_name ?? (eventIsWebinar ? null : feed.partner_name);
```

- [ ] **Step 3: Write price through**

Still in `harvestFeed`, in the `supabase.rpc('upsert_ingested_event', {...})` call, replace the `p_type`, `p_stream_url` and `p_platform` lines and add the two price lines:

```ts
      p_type: eventIsWebinar ? 'webinar' : 'local',
```

```ts
      p_stream_url: streamUrl,
      p_platform: eventIsWebinar ? 'other' : null,
      // is_free true ONLY for an explicit free signal. Both 'paid' and
      // 'unknown' write false, which is what the screener gate keys on.
      p_is_free: ev.cost === 'free',
      p_price_cents: ev.cost === 'paid' ? (ev.price_cents ?? null) : null,
```

Also update the description line so a ticket link is still appended for a paid in-person event (it is only redundant for webinars, where the link becomes `stream_url`):

```ts
    const description = [
      (ev.description ?? '').slice(0, 3800),
      ev.event_url && !eventIsWebinar ? `\n\nDetails & tickets: ${ev.event_url}` : '',
    ].join('');
```

- [ ] **Step 4: Parse-check and deploy**

```bash
cd "/Users/gp/The Village App/village-app"
npx --yes esbuild@0.23.0 supabase/functions/events-harvest/index.ts --loader:.ts=ts --bundle "--external:npm:*" "--external:jsr:*" --format=esm --outfile=/dev/null
git status --short -- supabase/functions/events-harvest/
/opt/homebrew/bin/supabase functions deploy events-harvest --project-ref albyndcruwopulazvpjs
```

Expected: clean parse, only your file modified, `Deployed Functions...`.

- [ ] **Step 5: Regression-check the four live feeds**

This is the highest-risk moment in the plan — every live feed flows through the changed code path.

```bash
/usr/bin/curl -sS -X POST "${EXPO_PUBLIC_SUPABASE_URL}/functions/v1/events-harvest" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Content-Type: application/json" \
  -d '{}' --max-time 300
```

Expected: every feed reports `upserted` equal to `found`, and `skipped` is 0. Then:

```sql
select f.partner_name,
       count(*) filter (where e.is_free) as free_rows,
       count(*) filter (where not e.is_free) as not_free_rows,
       count(*) filter (where e.type='webinar') as webinars
from events e join events_partner_feeds f on f.id = e.source_feed_id
group by f.partner_name order by f.partner_name;
```

Expected: PSI and all three La Leche League feeds show `not_free_rows = 0` and all rows `webinar`. The Underline shows `webinars = 0`. **If any live feed flips to `not_free_rows > 0`, stop** — the extractor is reading a free page as paid, and shipping that would pull healthy events out of the tab.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/events-harvest/index.ts
git commit -m "feat(plans): write per-event type and price through

Each event's own format now decides its type instead of inheriting the feed
default, so a page mixing virtual and in-person produces both webinar and
local rows. That is also the geographic fix: an in-person event elsewhere
becomes a local row, gets geocoded, and drops out of a Miami radius by
itself. Price writes through the new RPC params; both paid and unknown store
is_free=false."
```

---

### Task 4: Never auto-publish what is not known free

**Files:**
- Modify: `supabase/functions/ai-event-screen/index.ts` (`EventRow` interface, both `.select(...)` lists, promotion logic)

- [ ] **Step 1: Write the check that fails**

```sql
select count(*) as bad from events
where review_status = 'approved' and is_free = false;
```

Expected now: `0` only because nothing is marked paid yet. After Task 3 runs against a paid source this would become non-zero without this task — that is the hole being closed.

- [ ] **Step 2: Add `is_free` to the row type**

In `supabase/functions/ai-event-screen/index.ts`, in the `EventRow` interface, add:

```ts
  is_free: boolean;
```

- [ ] **Step 3: Select the column in both queries**

There are two `.select(...)` calls. Replace both select strings so they include `is_free`:

Single-event path:

```ts
        .select('id, title, description, type, host_name, city, venue_name, starts_at, is_partner, source_feed_id, review_status, is_free')
```

Batch path:

```ts
        .select('id, title, description, type, host_name, city, venue_name, starts_at, is_partner, source_feed_id, is_free')
```

- [ ] **Step 4: Gate the promotion**

Find the promotion block and replace it with:

```ts
  // Promotion logic
  let nextStatus: 'approved' | 'rejected' | 'pending';
  let outcome: ScreenResult['outcome'];
  if (confidence < 0.55) {
    nextStatus = 'rejected';
    outcome = 'rejected';
  } else if (confidence >= threshold) {
    nextStatus = 'approved';
    outcome = 'approved';
  } else {
    nextStatus = 'pending';
    outcome = 'pending';
  }

  // Commercial gate, applied AFTER scoring. is_free is false for both a known
  // price and an unstated one, so neither can auto-publish at any confidence.
  // A mother clicking through to a paid program deserves a human to have
  // looked first, and we must never imply "free" when the page didn't say so.
  // This reads a boolean already on the row — the model is never asked to
  // reason about money, so the screener's job stays "judge maternal relevance".
  // Deliberately does NOT rescue a 'rejected' verdict: irrelevant is still
  // irrelevant regardless of price.
  if (nextStatus === 'approved' && ev.is_free === false) {
    nextStatus = 'pending';
    outcome = 'pending';
  }
```

- [ ] **Step 5: Parse-check and deploy**

```bash
cd "/Users/gp/The Village App/village-app"
npx --yes esbuild@0.23.0 supabase/functions/ai-event-screen/index.ts --loader:.ts=ts --bundle "--external:npm:*" "--external:jsr:*" --format=esm --outfile=/dev/null
git status --short -- supabase/functions/ai-event-screen/
/opt/homebrew/bin/supabase functions deploy ai-event-screen --project-ref albyndcruwopulazvpjs
```

Expected: clean parse, only your file modified, `Deployed Functions on project albyndcruwopulazvpjs: ai-event-screen`.

- [ ] **Step 6: Prove the gate holds on a real paid event**

Register The Motherhood Center at a Tier-B threshold — high enough that these events *would* auto-publish if the gate were absent:

```bash
/usr/bin/curl -sS -X POST "${EXPO_PUBLIC_SUPABASE_URL}/functions/v1/events-harvest" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Content-Type: application/json" \
  -d '{"register":{"partner_name":"The Motherhood Center — Virtual","url":"https://themotherhoodcenter.com/support-groups/","city":"Online","timezone":"America/New_York","age_tags":["pregnancy","0-3mo","3-6mo","6-12mo"],"event_type":"webinar"}}' \
  --max-time 300
```

Then set it to 0.75 and re-screen:

```bash
/usr/bin/curl -sS -X PATCH "${EXPO_PUBLIC_SUPABASE_URL}/rest/v1/events_partner_feeds?partner_name=like.*Motherhood*" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"auto_publish_threshold":0.75,"notes":"Tier B — virtual + open, but TICKET-BASED. Price gate keeps every event in review."}'
```

Then assert:

```sql
select e.title, e.is_free, e.price_cents, e.review_status, e.ingestion_confidence
from events e join events_partner_feeds f on f.id = e.source_feed_id
where f.partner_name like '%Motherhood%' order by e.starts_at;
```

Expected: every row `is_free = false`, `review_status = 'pending'`, and `ingestion_confidence` above 0.75 on at least one. **A high confidence sitting at `pending` is the proof the gate works** — without it those rows would read `approved`.

- [ ] **Step 7: Confirm the live feeds still auto-publish**

```sql
select f.partner_name, e.review_status, count(*)
from events e join events_partner_feeds f on f.id = e.source_feed_id
where f.partner_name not like '%Motherhood%' and e.ends_at > now()
group by f.partner_name, e.review_status order by f.partner_name;
```

Expected: PSI and the three LLL feeds still show `approved` rows. If they moved to `pending`, Task 2's free-signal detection regressed — fix that before continuing.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/ai-event-screen/index.ts
git commit -m "feat(plans): never auto-publish an event that isn't known free

Applies a deterministic gate after scoring: is_free=false (a known price OR
an unstated one) pins review_status to pending regardless of confidence or
feed threshold. Lives here rather than in events-harvest because every row is
inserted pending by the RPC anyway — the screener is the only thing that can
withhold promotion. Reads a boolean, so relevance judgment is unaffected."
```

---

### Task 5: Show the price

**Files:**
- Modify: `apps/mobile/src/i18n/en.json`, `apps/mobile/src/i18n/es.json`
- Modify: `apps/mobile/src/screens/events/EventDetailScreen.tsx`

The spec assumed the client already rendered price. It does not — `is_free` and `price_cents` are selected into the type and displayed nowhere. Without this task a paid event shows **no price signal at all**, which is worse than a wrong one.

- [ ] **Step 1: Write the check that fails**

```bash
cd "/Users/gp/The Village App/village-app"
/usr/bin/grep -rn "is_free\|price_cents" apps/mobile/src/screens/events/ || echo "NOT RENDERED ANYWHERE"
```

Expected now: `NOT RENDERED ANYWHERE`.

- [ ] **Step 2: Add EN copy**

In `apps/mobile/src/i18n/en.json`, inside the `"eventDetail"` object, add these four keys:

```json
    "sectionCost": "Cost",
    "costFree": "Free",
    "costAmount": "${{amount}}",
    "costSeeDetails": "See details for pricing",
```

- [ ] **Step 3: Add ES copy**

In `apps/mobile/src/i18n/es.json`, inside the `"eventDetail"` object, add:

```json
    "sectionCost": "Costo",
    "costFree": "Gratis",
    "costAmount": "${{amount}}",
    "costSeeDetails": "Consulta los detalles para el precio",
```

- [ ] **Step 4: Validate both files still parse**

```bash
cd "/Users/gp/The Village App/village-app"
/usr/bin/python3 -c "import json; json.load(open('apps/mobile/src/i18n/en.json')); json.load(open('apps/mobile/src/i18n/es.json')); print('both parse OK')"
```

Expected: `both parse OK`. A trailing comma or missing quote breaks the whole app, so do not skip this.

- [ ] **Step 5: Render the cost row**

In `apps/mobile/src/screens/events/EventDetailScreen.tsx`, find the "when" section:

```tsx
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('eventDetail.sectionWhen')}</Text>
          <Text style={styles.sectionValue}>{formatEventWhen(event.starts_at, event.ends_at, event.timezone)}</Text>
          {isWebinar && <Text style={styles.countdown}>{timeUntilLabel(event.starts_at)}</Text>}
        </View>
```

Insert this block immediately after that closing `</View>`:

```tsx
        {/* Cost. `is_free === false` covers BOTH a known price and a price the
            source never stated — never render "Free" or "$0.00" for either,
            because a mother acts on this. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('eventDetail.sectionCost')}</Text>
          <Text style={styles.sectionValue}>
            {event.is_free
              ? t('eventDetail.costFree')
              : event.price_cents != null
                ? t('eventDetail.costAmount', { amount: (event.price_cents / 100).toFixed(2) })
                : t('eventDetail.costSeeDetails')}
          </Text>
        </View>
```

- [ ] **Step 6: Typecheck**

```bash
cd "/Users/gp/The Village App/village-app" && npx tsc --noEmit -p apps/mobile/tsconfig.json
```

Expected: no output (success). `is_free` and `price_cents` are already on the `EventCard` type, so no type change is needed.

- [ ] **Step 7: Run the check from Step 1 again**

```bash
/usr/bin/grep -rn "is_free\|price_cents" apps/mobile/src/screens/events/
```

Expected: matches in `EventDetailScreen.tsx`. Confirm the three branches by reading the block back: free → "Free"; false with a figure → "$30.00"; false with null → "See details for pricing". Confirm none of them can print "$0.00".

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/i18n/en.json apps/mobile/src/i18n/es.json apps/mobile/src/screens/events/EventDetailScreen.tsx
git commit -m "feat(plans): show event cost on the detail screen

is_free and price_cents were fetched into the model and rendered nowhere, so
a paid event would have shown no price signal at all. Three explicit
branches; is_free=false with a null price says 'See details for pricing'
rather than falling through to Free or \$0.00. EN + ES."
```

---

### Task 6: Land it and document the state

**Files:**
- Modify: `docs/superpowers/specs/2026-08-12-villie-plans-per-event-attributes-design.md`

- [ ] **Step 1: Full end-to-end assertion**

```sql
select
  (select count(*) from list_events_near(25.7307897,-80.2377078,16.09,null,null)) as live_at_10mi,
  (select count(*) from events where review_status='pending') as queue_depth,
  (select count(*) from events where is_free = false and review_status='approved') as paid_published,
  (select count(*) from events where is_free = false) as paid_total;
```

Expected: `paid_published = 0` (the whole point), `paid_total > 0` (proving paid events ingest rather than being dropped), `live_at_10mi` at least the count before this work started.

- [ ] **Step 2: Confirm mixed-format handling on a real mixed source**

Postpartum Support Virginia mixes virtual with in-person Virginia events — the case that previously had no safe handling.

```bash
/usr/bin/curl -sS -X POST "${EXPO_PUBLIC_SUPABASE_URL}/functions/v1/events-harvest" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Content-Type: application/json" \
  -d '{"probe":{"url":"https://postpartumva.org/support-groups/"}}' --max-time 240 \
  | /usr/bin/python3 -c "
import sys,json
d=json.load(sys.stdin)
from collections import Counter
c=Counter(e.get('format') for e in (d.get('events') or []))
print('format mix:', dict(c))
"
```

Expected: **both** `in_person` and `virtual` present. That mix is what proves per-event format works; a single value everywhere means the prompt is not discriminating and Step 3 will mislead you.

Do **not** register this feed as part of this plan — its in-person events are correct but out-of-market, and registering it is a separate product call.

- [ ] **Step 3: Mark the spec implemented**

In `docs/superpowers/specs/2026-08-12-villie-plans-per-event-attributes-design.md`, immediately under the `**Status:**` line, add:

```markdown
**Implemented:** 2026-08-12 — migration 118 + events-harvest + ai-event-screen + EventDetailScreen. The Motherhood Center registered as the first mixed/paid source; every one of its events sits in review by design.
```

- [ ] **Step 4: Push everything to main**

The primary checkout is shared and not on `main`. Use a detached worktree:

```bash
cd "/Users/gp/The Village App/village-app"
WT=/tmp/wt-price-impl && /bin/rm -rf "$WT"
git fetch origin main --quiet && git worktree add --detach "$WT" origin/main
/bin/cp supabase/migrations/118_event_price_passthrough.sql "$WT/supabase/migrations/"
/bin/cp supabase/functions/events-harvest/index.ts "$WT/supabase/functions/events-harvest/index.ts"
/bin/cp supabase/functions/ai-event-screen/index.ts "$WT/supabase/functions/ai-event-screen/index.ts"
/bin/cp apps/mobile/src/i18n/en.json "$WT/apps/mobile/src/i18n/en.json"
/bin/cp apps/mobile/src/i18n/es.json "$WT/apps/mobile/src/i18n/es.json"
/bin/cp apps/mobile/src/screens/events/EventDetailScreen.tsx "$WT/apps/mobile/src/screens/events/EventDetailScreen.tsx"
/bin/cp docs/superpowers/specs/2026-08-12-villie-plans-per-event-attributes-design.md "$WT/docs/superpowers/specs/"
cd "$WT" && git add -A
```

Before committing, confirm you are not reverting anyone else's work:

```bash
git diff --cached --stat
git diff --cached -U0 | /usr/bin/grep -E "^-[^-]"
```

Expected: only lines you intended to replace. If you see unfamiliar deletions, the shared checkout was behind `main` on that file — re-copy from `origin/main`, reapply your edit, and repeat.

```bash
git commit -m "feat(plans): per-event price and format

Unlocks source pages that mix free with paid and virtual with in-person,
which had blocked four researched postpartum sources. Correct per-event
typing doubles as the geographic filter: an in-person event elsewhere
becomes a local row and falls outside the radius on its own.

Paid and price-unstated events never auto-publish at any confidence."
git push origin HEAD:main
cd - && git worktree remove "$WT" --force
```

- [ ] **Step 5: Confirm the tree is clean and the branch untouched**

```bash
cd "/Users/gp/The Village App/village-app" && git branch --show-current && git worktree list
```

Expected: the branch is whatever it was before you started (**not** `main`), and your temporary worktree is gone.

---

## Verification Summary

| Spec requirement | Task |
|---|---|
| §3.1 extract price per event | 2 |
| §3.2 extract format per event | 2 |
| §3.3 write-through, no schema change | 1, 3 |
| §3.4 paid and unknown never auto-publish, gate in screener | 4 |
| §3.5 honest price display, no "$0.00" | 5 |
| §5.2 correct typing is the geo filter | 3, 6 |
| §7.6 live feeds unchanged | 3 (Step 5), 4 (Step 7) |
| §7.7 paid renders honestly | 5 (Step 7) |

**Not covered, deliberately:** §6 residency and eligibility restrictions. A California-residents-only free virtual group still auto-publishes. It needs a source that actually hits the case before it is worth building for.
