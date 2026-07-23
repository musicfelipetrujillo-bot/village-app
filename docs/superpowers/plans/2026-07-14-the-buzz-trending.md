# The Buzz — Trending Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "The Buzz" — a weekly editorial trending-topics digest (3 news items + 1 myth-buster, each paired with a trend source and a grounding source) with a two-tier review gate, a Home card, a full-screen reader, and a Manual archive — per the approved spec at `docs/THE_BUZZ_TRENDING.md`.

**Architecture:** New `trending_issues`/`trending_items` tables (migration 105) extend the existing clinical-review RPC trio (`list_pending_review`/`approve_content_row`/`reject_content_row` from migrations 042/043) with a `trending_items` arm, gated on a new `is_medical_claim` column rather than item kind. Two isolated scheduled Claude Code agents populate content weekly (Step A discovery via `last30days-skill`, no DB credential; Step B allowlist-constrained sourcing + ingest, holds the DB credential) — Step B posts to a new `trending-ingest` Edge Function. A `trending-compliance-pass` Edge Function auto-clears non-medical items; medical-claim items always wait for a human via the existing (extended) `ClinicalReviewScreen`. A DB trigger auto-publishes an issue once every item is cleared/approved and fires a push via a new `trending-publish-notify` Edge Function. Mobile surfaces: a Home card in the currently-mounted `HomeScreenV3.tsx`, a new `TheBuzzScreen` (live + archive mode via an optional `issueId` param), and a new `BuzzArchiveScreen` reachable from the Manual tab.

**Tech Stack:** Supabase Postgres (RLS + SQL triggers + SECURITY DEFINER RPCs), Deno Edge Functions (`jsr:@supabase/supabase-js@2`, `npm:@anthropic-ai/sdk`), React Native + Expo (React Navigation native-stack, Zustand, this repo's hand-rolled i18n).

---

## Important corrections discovered during planning (read before starting)

1. **The spec's original migration number `~096` is stale.** It was first renumbered to 104 (096–103 were already used by other shipped work), then renumbered again to **105** during implementation when `main` gained its own migration 104 (`104_security_backfill_rls_auto_enable.sql`, an unrelated fix) while this branch was in flight.
2. **`trending_items.status` needs a 5th enum value.** The spec's §3 lists `draft | agent_cleared | approved | rejected`, but §4's pipeline description requires an `in_review` state (where medical-claim items sit pending human review). This plan uses the correct 5-value enum: `draft | agent_cleared | in_review | approved | rejected`.
3. **`home-feed-curator`'s card system is dormant on the currently-mounted Home screen.** `HomeNavigator.tsx` points `HomeRoot` at `HomeScreenV3.tsx`, which does **not** consume `home_feed_cache`/`home-feed-curator` at all (that plumbing only exists in the older, unmounted `HomeScreen.tsx`). Rather than wire an entire dormant subsystem back in, the Buzz Home card is built as a small self-contained section directly inside `HomeScreenV3.tsx` that fetches the current issue itself — functionally identical to what the spec asked for ("a card appears on Home when a published issue exists"), just simpler and correct for the code that's actually running.
4. **Closing the "reviewer can flip a mis-tagged item back to medical" loop.** The approved spec says a human should be able to flip `is_medical_claim` back to `TRUE` if the agent mis-tagged something — but items that auto-clear (`agent_cleared`) never enter the human review queue by construction, so a reviewer would never see one to flip. This plan adds a small "recently auto-cleared" list + a one-way `flag_trending_item_as_medical` RPC (FALSE→TRUE only — there is no RPC path for a human to go the other way) so this is a real, working safety net rather than a spec line with no surface.
5. **Broadcast push has no existing "everyone" addressing mode.** `push-notify` only accepts explicit `user_id`/`external_ids`/`player_ids` lists. `trending-publish-notify` builds that candidate list itself (query `users` for non-opted-out ids) rather than extending `push-notify`'s schema — `push-notify`'s existing central pref/quiet-hours gate still re-filters the list it's given, so nothing bypasses that safety net.
6. **Spec §6 requires audit events for publish + each review decision** — easy to miss since it's one line in the compliance section, not called out in §3/§4's mechanics. Task 2's SQL wires `admin_audit_log` inserts (real schema: `id, action, target_table, target_id, performed_by, metadata, created_at` from migration 016) into `approve_content_row`/`reject_content_row`'s `trending_items` arm, `flag_trending_item_as_medical`, and the auto-publish trigger.

---

## File structure

**Create:**
- `supabase/migrations/105_v7_the_buzz.sql`
- `supabase/functions/trending-ingest/index.ts`
- `supabase/functions/trending-compliance-pass/index.ts`
- `supabase/functions/trending-publish-notify/index.ts`
- `apps/mobile/src/api/theBuzz.ts`
- `apps/mobile/src/screens/home/TheBuzzScreen.tsx`
- `apps/mobile/src/screens/manual/BuzzArchiveScreen.tsx`

**Modify:**
- `apps/mobile/src/api/clinical-review.ts` (extend `ReviewableSourceTable`/`PendingReviewRow`/`sourceTableLabel`)
- `apps/mobile/src/screens/internal/ClinicalReviewScreen.tsx` (render the trending_items card variant + "recently auto-cleared" flag section)
- `supabase/functions/push-notify/index.ts` (add `'trending'` to `VALID_PREF_KEYS`)
- `apps/mobile/src/store/user.ts` (add `'trending'` to `NotifPrefKey` + `DEFAULT_NOTIF_PREFS`)
- `apps/mobile/src/screens/me/NotificationPreferencesScreen.tsx` (add the trending toggle row)
- `apps/mobile/src/navigation/HomeNavigator.tsx` (register `TheBuzz` route)
- `apps/mobile/src/navigation/ManualNavigator.tsx` (register `TheBuzz` + `BuzzArchive` routes)
- `apps/mobile/src/screens/home/HomeScreenV3.tsx` (add the Buzz Home card)
- `apps/mobile/src/i18n/en.json` + `apps/mobile/src/i18n/es.json` (new `theBuzz`, `buzzArchive` sections + `notifPrefs.rowTrending*` + `home.buzzCard*` + `manualMenu.buzzArchive*` keys)
- `apps/mobile/src/screens/manual/ManualScrollV3.tsx` (add a "Buzz archive" hamburger-menu entry)
- `docs/VILLIE_AGENTS.md` (document the two new scheduled agents)

---

## Phase B1 — Data model + review-RPC extension

### Task 1: Migration 105, part A — tables, RLS, allowlist trigger, auto-publish trigger

**Files:**
- Create: `supabase/migrations/105_v7_the_buzz.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 105_v7_the_buzz.sql — The Buzz: weekly trending maternal-health digest.
-- Spec: docs/THE_BUZZ_TRENDING.md. Editorial (not clinical) surface — every
-- item pairs a trend signal with a grounding source, both restricted to an
-- allowlisted domain set enforced at insert. Review gate is keyed on
-- is_medical_claim (not item kind): non-medical items auto-clear via an
-- automated compliance pass, medical-claim items always require a human
-- clinical reviewer sign-off (reuses is_clinical_reviewer() from migration 043).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. trending_source_allowlist — reference table, service-role only.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trending_source_allowlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain      TEXT NOT NULL,
  tier        TEXT NOT NULL CHECK (tier IN ('trend', 'evidence')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (domain, tier)
);

ALTER TABLE trending_source_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trending_source_allowlist_service_all" ON trending_source_allowlist
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO trending_source_allowlist (domain, tier) VALUES
  ('apnews.com', 'trend'),
  ('reuters.com', 'trend'),
  ('nytimes.com', 'trend'),
  ('washingtonpost.com', 'trend'),
  ('motherly.com', 'trend'),
  ('parents.com', 'trend'),
  ('romper.com', 'trend'),
  ('acog.org', 'evidence'),
  ('aap.org', 'evidence'),
  ('cdc.gov', 'evidence'),
  ('who.int', 'evidence'),
  ('nih.gov', 'evidence'),
  ('pubmed.ncbi.nlm.nih.gov', 'evidence'),
  ('llli.org', 'evidence')
ON CONFLICT (domain, tier) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. trending_issues — one row per weekly issue.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trending_issues (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_date    DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  published_at  TIMESTAMPTZ,
  title         TEXT NOT NULL,
  intro         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (issue_date)
);

ALTER TABLE trending_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trending_issues_public_read" ON trending_issues
  FOR SELECT TO authenticated
  USING (status = 'published');

CREATE POLICY "trending_issues_reviewer_read" ON trending_issues
  FOR SELECT TO authenticated
  USING (is_clinical_reviewer());

CREATE POLICY "trending_issues_service_write" ON trending_issues
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 3. trending_items — belongs to an issue.
--    status enum includes 'in_review' (missing from the original spec's §3
--    list but required by its own §4 pipeline description — see plan header).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trending_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id               UUID NOT NULL REFERENCES trending_issues(id) ON DELETE CASCADE,
  kind                   TEXT NOT NULL CHECK (kind IN ('news', 'myth_buster')),
  rank                   INTEGER NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'agent_cleared', 'in_review', 'approved', 'rejected')),
  is_medical_claim       BOOLEAN NOT NULL DEFAULT TRUE,

  trend_source_name      TEXT NOT NULL,
  trend_source_url       TEXT NOT NULL,
  evidence_source_name   TEXT NOT NULL,
  evidence_source_url    TEXT NOT NULL,

  title_en               TEXT NOT NULL,
  title_es               TEXT,
  summary_en             TEXT NOT NULL,
  summary_es             TEXT,
  myth_claim_en          TEXT,
  myth_claim_es          TEXT,
  fact_en                TEXT,
  fact_es                TEXT,
  ask_provider_en        TEXT NOT NULL,
  ask_provider_es        TEXT,

  reviewed_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at            TIMESTAMPTZ,
  review_notes           TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT trending_items_myth_fields CHECK (
    kind <> 'myth_buster' OR (myth_claim_en IS NOT NULL AND fact_en IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_trending_items_issue ON trending_items(issue_id, rank);
CREATE INDEX IF NOT EXISTS idx_trending_items_review_queue
  ON trending_items(status, is_medical_claim)
  WHERE status = 'in_review' AND is_medical_claim = TRUE;

ALTER TABLE trending_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trending_items_public_read" ON trending_items
  FOR SELECT TO authenticated
  USING (status IN ('approved', 'agent_cleared'));

CREATE POLICY "trending_items_reviewer_read" ON trending_items
  FOR SELECT TO authenticated
  USING (is_clinical_reviewer());

CREATE POLICY "trending_items_service_write" ON trending_items
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Source-allowlist enforcement — BEFORE INSERT/UPDATE trigger. This is
--    the real enforcement point regardless of what any research agent's
--    prompt believes it verified (docs/THE_BUZZ_TRENDING.md §3/§6).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION extract_url_domain(p_url TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      split_part(regexp_replace(p_url, '^https?://', ''), '/', 1),
      '^www\.', ''
    )
  );
$$;

CREATE OR REPLACE FUNCTION check_trending_source_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_trend_domain    TEXT := extract_url_domain(NEW.trend_source_url);
  v_evidence_domain TEXT := extract_url_domain(NEW.evidence_source_url);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM trending_source_allowlist
    WHERE tier = 'trend' AND domain = v_trend_domain
  ) THEN
    RAISE EXCEPTION 'trend_source_url domain % is not on the trend allowlist', v_trend_domain
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM trending_source_allowlist
    WHERE tier = 'evidence' AND domain = v_evidence_domain
  ) THEN
    RAISE EXCEPTION 'evidence_source_url domain % is not on the evidence allowlist', v_evidence_domain
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trending_items_allowlist_check
  BEFORE INSERT OR UPDATE OF trend_source_url, evidence_source_url ON trending_items
  FOR EACH ROW EXECUTE FUNCTION check_trending_source_allowlist();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Auto-publish — when every item on an issue reaches a terminal-cleared
--    status, flip the issue to published. The founder's last approve tap
--    in the review screen IS the publish action; there is no separate
--    manual publish step or screen. Fires a fire-and-forget pg_net POST to
--    trending-publish-notify (deployed in B4) — safe no-op locally where
--    pg_net/the app.* GUCs aren't configured.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trending_items_after_review()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_all_done BOOLEAN;
  v_issue    trending_issues%ROWTYPE;
BEGIN
  IF NEW.status NOT IN ('approved', 'agent_cleared') THEN
    RETURN NEW;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM trending_items
    WHERE issue_id = NEW.issue_id
      AND status NOT IN ('approved', 'agent_cleared')
  ) INTO v_all_done;

  IF v_all_done THEN
    UPDATE trending_issues
       SET status = 'published', published_at = now(), updated_at = now()
     WHERE id = NEW.issue_id
       AND status <> 'published'
     RETURNING * INTO v_issue;

    IF FOUND THEN
      INSERT INTO admin_audit_log (action, target_table, target_id, performed_by, metadata)
      VALUES (
        'publish_trending_issue', 'trending_issues', v_issue.id, 'system',
        jsonb_build_object('issue_date', v_issue.issue_date, 'title', v_issue.title)
      );

      BEGIN
        PERFORM net.http_post(
          url     := current_setting('app.supabase_url') || '/functions/v1/trending-publish-notify',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
          ),
          body    := jsonb_build_object('issue_id', v_issue.id)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL; -- pg_net/GUCs unavailable — publish itself still succeeded.
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trending_items_after_review_trg
  AFTER UPDATE OF status ON trending_items
  FOR EACH ROW EXECUTE FUNCTION trending_items_after_review();
```

- [ ] **Step 2: Apply locally**

Run: `cd "/Users/gp/The Village App/village-app" && supabase db reset`
Expected: migration `105_v7_the_buzz.sql` applies with no errors, output ends with the seed-data summary line Supabase CLI normally prints.

- [ ] **Step 3: Verify the allowlist trigger actually rejects an off-allowlist domain**

Run:
```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2 | tr -d '"')" -c "
INSERT INTO trending_issues (issue_date, title, intro) VALUES ('2026-07-20', 'test', 'test') RETURNING id;
"
```
Note the returned `id`, then:
```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2 | tr -d '"')" -c "
INSERT INTO trending_items (issue_id, kind, rank, trend_source_name, trend_source_url, evidence_source_name, evidence_source_url, title_en, summary_en, ask_provider_en)
VALUES ('<paste-id>', 'news', 1, 'Random Blog', 'https://not-on-the-list.example.com/post', 'CDC', 'https://cdc.gov/foo', 't', 's', 'a');
"
```
Expected: `ERROR: trend_source_url domain not-on-the-list.example.com is not on the trend allowlist`

Then retry with `https://apnews.com/some-article` as `trend_source_url` and `https://cdc.gov/foo` as `evidence_source_url` — expected: `INSERT 0 1` (succeeds).

- [ ] **Step 4: Verify the auto-publish trigger**

With the item inserted above, run:
```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2 | tr -d '"')" -c "
UPDATE trending_items SET status = 'approved' WHERE trend_source_name = 'AP News' AND rank = 1;
SELECT status, published_at FROM trending_issues WHERE title = 'test';
"
```
Expected: `status = published`, `published_at` is non-null (this issue only had the one item, so it's "all done" immediately).

Clean up test rows: `DELETE FROM trending_issues WHERE title = 'test';` (cascades to `trending_items`).

- [ ] **Step 5: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add supabase/migrations/105_v7_the_buzz.sql && git commit -m "$(cat <<'EOF'
feat: add The Buzz data model (migration 105)

trending_issues/trending_items + source allowlist enforced at insert +
auto-publish trigger. Uses a 5-value status enum (adds in_review, missing
from the original spec's table but required by its own pipeline
description).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Migration 105, part B — extend review RPCs + new read RPCs + notif_prefs default

**Files:**
- Modify: `supabase/migrations/105_v7_the_buzz.sql` (append to the same file — one migration, two tasks purely for plan granularity)

- [ ] **Step 1: Append the RPC extensions to the migration file**

```sql
-- ─────────────────────────────────────────────────────────────────────────
-- 6. list_pending_review() — add a trending_items arm. Return type changes
--    (new nullable columns), so the function must be dropped first.
-- ─────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS list_pending_review();

CREATE OR REPLACE FUNCTION list_pending_review()
RETURNS TABLE (
  source_table              TEXT,
  row_id                    UUID,
  week_number               INTEGER,
  category                  TEXT,
  title                     TEXT,
  body_en                   TEXT,
  body_es                   TEXT,
  hero_emoji                TEXT,
  requires_crisis_footer    BOOLEAN,
  cta_label                 TEXT,
  cta_target                TEXT,
  is_essential              BOOLEAN,
  review_status             TEXT,
  clinical_advisor_reviewed BOOLEAN,
  review_notes              TEXT,
  created_at                TIMESTAMPTZ,
  is_medical_claim          BOOLEAN,
  trend_source_name         TEXT,
  trend_source_url          TEXT,
  evidence_source_name      TEXT,
  evidence_source_url       TEXT,
  myth_claim_en             TEXT,
  fact_en                   TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT is_clinical_reviewer() AS ok
  )
  SELECT
    'maternal_insights'::TEXT AS source_table,
    mi.id AS row_id,
    mi.week_number,
    mi.category,
    mi.title,
    mi.body AS body_en,
    mi_es.body AS body_es,
    mi.hero_emoji,
    mi.requires_crisis_footer,
    NULL::TEXT AS cta_label,
    NULL::TEXT AS cta_target,
    NULL::BOOLEAN AS is_essential,
    mi.review_status,
    mi.clinical_advisor_reviewed,
    mi.review_notes,
    mi.created_at,
    NULL::BOOLEAN AS is_medical_claim,
    NULL::TEXT AS trend_source_name, NULL::TEXT AS trend_source_url,
    NULL::TEXT AS evidence_source_name, NULL::TEXT AS evidence_source_url,
    NULL::TEXT AS myth_claim_en, NULL::TEXT AS fact_en
  FROM maternal_insights mi
  LEFT JOIN maternal_insights_i18n mi_es
    ON mi_es.insight_id = mi.id AND mi_es.locale = 'es'
  WHERE (SELECT ok FROM allowed)
    AND mi.clinical_advisor_reviewed = FALSE

  UNION ALL

  SELECT
    'village_supports'::TEXT,
    vs.id,
    vs.week_number,
    vs.support_type,
    vs.title,
    vs.body,
    vs_es.body,
    vs.hero_emoji,
    FALSE,
    vs.cta_label,
    vs.cta_target,
    NULL::BOOLEAN,
    vs.review_status,
    vs.clinical_advisor_reviewed,
    vs.review_notes,
    vs.created_at,
    NULL::BOOLEAN, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT
  FROM village_supports vs
  LEFT JOIN village_supports_i18n vs_es
    ON vs_es.support_id = vs.id AND vs_es.locale = 'es'
  WHERE (SELECT ok FROM allowed)
    AND vs.clinical_advisor_reviewed = FALSE

  UNION ALL

  SELECT
    'week_checklists'::TEXT,
    wc.id,
    wc.week_number,
    wc.category,
    wc.item_text,
    wc.item_text,
    wc_es.item_text,
    NULL::TEXT,
    FALSE,
    NULL::TEXT,
    NULL::TEXT,
    wc.is_essential,
    wc.review_status,
    wc.clinical_advisor_reviewed,
    wc.review_notes,
    wc.created_at,
    NULL::BOOLEAN, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT
  FROM week_checklists wc
  LEFT JOIN week_checklists_i18n wc_es
    ON wc_es.checklist_item_id = wc.id AND wc_es.locale = 'es'
  WHERE (SELECT ok FROM allowed)
    AND wc.clinical_advisor_reviewed = FALSE

  UNION ALL

  SELECT
    'trending_items'::TEXT,
    ti.id,
    EXTRACT(WEEK FROM tis.issue_date)::INTEGER AS week_number,
    ti.kind AS category,
    ti.title_en AS title,
    ti.summary_en AS body_en,
    ti.summary_es AS body_es,
    NULL::TEXT AS hero_emoji,
    FALSE AS requires_crisis_footer,
    NULL::TEXT AS cta_label,
    NULL::TEXT AS cta_target,
    NULL::BOOLEAN AS is_essential,
    ti.status AS review_status,
    FALSE AS clinical_advisor_reviewed,
    ti.review_notes,
    ti.created_at,
    ti.is_medical_claim,
    ti.trend_source_name, ti.trend_source_url,
    ti.evidence_source_name, ti.evidence_source_url,
    ti.myth_claim_en, ti.fact_en
  FROM trending_items ti
  JOIN trending_issues tis ON tis.id = ti.issue_id
  WHERE (SELECT ok FROM allowed)
    AND ti.status = 'in_review'
    AND ti.is_medical_claim = TRUE

  ORDER BY week_number ASC, requires_crisis_footer DESC NULLS LAST, source_table, created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION list_pending_review() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. approve_content_row / reject_content_row — add a trending_items arm.
--    trending_items has no clinical_advisor_reviewed column; status alone
--    is the source of truth, so these arms only touch status/reviewed_*.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION approve_content_row(
  p_table TEXT,
  p_id    UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NOT is_clinical_reviewer() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_table NOT IN ('maternal_insights', 'village_supports', 'week_checklists', 'trending_items') THEN
    RAISE EXCEPTION 'invalid table: %', p_table USING ERRCODE = '22023';
  END IF;

  IF p_table = 'maternal_insights' THEN
    UPDATE maternal_insights
       SET review_status = 'approved', clinical_advisor_reviewed = TRUE,
           reviewed_by = v_uid, reviewed_at = NOW(), review_notes = p_notes
     WHERE id = p_id;
  ELSIF p_table = 'village_supports' THEN
    UPDATE village_supports
       SET review_status = 'approved', clinical_advisor_reviewed = TRUE,
           reviewed_by = v_uid, reviewed_at = NOW(), review_notes = p_notes
     WHERE id = p_id;
  ELSIF p_table = 'week_checklists' THEN
    UPDATE week_checklists
       SET review_status = 'approved', clinical_advisor_reviewed = TRUE,
           reviewed_by = v_uid, reviewed_at = NOW(), review_notes = p_notes
     WHERE id = p_id;
  ELSE
    UPDATE trending_items
       SET status = 'approved',
           reviewed_by = v_uid, reviewed_at = NOW(), review_notes = p_notes,
           updated_at = NOW()
     WHERE id = p_id
       AND status = 'in_review';
    IF FOUND THEN
      INSERT INTO admin_audit_log (action, target_table, target_id, performed_by, metadata)
      VALUES (
        'approve_trending_item', 'trending_items', p_id,
        COALESCE((SELECT email FROM public.users WHERE id = v_uid), v_uid::TEXT),
        jsonb_build_object('notes', p_notes)
      );
    END IF;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found in %: %', p_table, p_id USING ERRCODE = '02000';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION reject_content_row(
  p_table TEXT,
  p_id    UUID,
  p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NOT is_clinical_reviewer() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_notes IS NULL OR char_length(trim(p_notes)) < 3 THEN
    RAISE EXCEPTION 'rejection notes required (min 3 chars)' USING ERRCODE = '22023';
  END IF;

  IF p_table NOT IN ('maternal_insights', 'village_supports', 'week_checklists', 'trending_items') THEN
    RAISE EXCEPTION 'invalid table: %', p_table USING ERRCODE = '22023';
  END IF;

  IF p_table = 'maternal_insights' THEN
    UPDATE maternal_insights
       SET review_status = 'rejected', clinical_advisor_reviewed = TRUE,
           reviewed_by = v_uid, reviewed_at = NOW(), review_notes = p_notes
     WHERE id = p_id;
  ELSIF p_table = 'village_supports' THEN
    UPDATE village_supports
       SET review_status = 'rejected', clinical_advisor_reviewed = TRUE,
           reviewed_by = v_uid, reviewed_at = NOW(), review_notes = p_notes
     WHERE id = p_id;
  ELSIF p_table = 'week_checklists' THEN
    UPDATE week_checklists
       SET review_status = 'rejected', clinical_advisor_reviewed = TRUE,
           reviewed_by = v_uid, reviewed_at = NOW(), review_notes = p_notes
     WHERE id = p_id;
  ELSE
    UPDATE trending_items
       SET status = 'rejected',
           reviewed_by = v_uid, reviewed_at = NOW(), review_notes = p_notes,
           updated_at = NOW()
     WHERE id = p_id
       AND status = 'in_review';
    IF FOUND THEN
      INSERT INTO admin_audit_log (action, target_table, target_id, performed_by, metadata)
      VALUES (
        'reject_trending_item', 'trending_items', p_id,
        COALESCE((SELECT email FROM public.users WHERE id = v_uid), v_uid::TEXT),
        jsonb_build_object('notes', p_notes)
      );
    END IF;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found in %: %', p_table, p_id USING ERRCODE = '02000';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_content_row(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_content_row(TEXT, UUID, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Public read RPCs — hydrate an issue + its cleared items in one call.
--    Plain SECURITY INVOKER: RLS on trending_issues/trending_items already
--    enforces the same "published/approved only" condition these RPCs
--    filter on, so no elevated privilege is needed here.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_trending_issue(p_issue_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', ti.id,
    'issue_date', ti.issue_date,
    'title', ti.title,
    'intro', ti.intro,
    'published_at', ti.published_at,
    'items', COALESCE(items.items, '[]'::jsonb)
  )
  FROM trending_issues ti
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', it.id, 'kind', it.kind, 'rank', it.rank,
        'title_en', it.title_en, 'title_es', it.title_es,
        'summary_en', it.summary_en, 'summary_es', it.summary_es,
        'myth_claim_en', it.myth_claim_en, 'myth_claim_es', it.myth_claim_es,
        'fact_en', it.fact_en, 'fact_es', it.fact_es,
        'ask_provider_en', it.ask_provider_en, 'ask_provider_es', it.ask_provider_es,
        'trend_source_name', it.trend_source_name, 'trend_source_url', it.trend_source_url,
        'evidence_source_name', it.evidence_source_name, 'evidence_source_url', it.evidence_source_url
      ) ORDER BY it.rank
    ) AS items
    FROM trending_items it
    WHERE it.issue_id = ti.id
      AND it.status IN ('approved', 'agent_cleared')
  ) items ON true
  WHERE ti.status = 'published'
    AND (p_issue_id IS NULL OR ti.id = p_issue_id)
  ORDER BY ti.issue_date DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_trending_issue(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION list_trending_archive()
RETURNS TABLE (id UUID, issue_date DATE, title TEXT, intro TEXT, published_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
AS $$
  SELECT id, issue_date, title, intro, published_at
  FROM trending_issues
  WHERE status = 'published'
  ORDER BY issue_date DESC;
$$;

GRANT EXECUTE ON FUNCTION list_trending_archive() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. flag_trending_item_as_medical — one-way (FALSE→TRUE) safety net so a
--    reviewer can pull a mis-tagged, already-auto-cleared item back into
--    the mandatory human queue. No RPC exists for the reverse direction —
--    the review UI can never be used to wave a medical item through as
--    non-medical.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION flag_trending_item_as_medical(
  p_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_clinical_reviewer() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE trending_items
     SET is_medical_claim = TRUE,
         status = 'in_review',
         review_notes = COALESCE(p_notes, review_notes),
         updated_at = now()
   WHERE id = p_id
     AND status = 'agent_cleared';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not found or not agent_cleared: %', p_id USING ERRCODE = '02000';
  END IF;

  INSERT INTO admin_audit_log (action, target_table, target_id, performed_by, metadata)
  VALUES (
    'flag_trending_item_as_medical', 'trending_items', p_id,
    COALESCE((SELECT email FROM public.users WHERE id = auth.uid()), auth.uid()::TEXT),
    jsonb_build_object('notes', p_notes)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION flag_trending_item_as_medical(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION list_recent_agent_cleared_trending_items()
RETURNS TABLE (
  id UUID, issue_id UUID, kind TEXT, title_en TEXT, summary_en TEXT,
  trend_source_url TEXT, evidence_source_url TEXT, created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ti.id, ti.issue_id, ti.kind, ti.title_en, ti.summary_en,
         ti.trend_source_url, ti.evidence_source_url, ti.created_at
  FROM trending_items ti
  WHERE is_clinical_reviewer()
    AND ti.status = 'agent_cleared'
    AND ti.created_at > now() - INTERVAL '30 days'
  ORDER BY ti.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION list_recent_agent_cleared_trending_items() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. notif_prefs — add the 'trending' key (mirrors migration 033's
--     extend-default + backfill idiom). Missing-key semantics elsewhere in
--     this codebase already treat an absent key as opted-in, so this is a
--     convenience for new-signup rows, not a correctness requirement.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ALTER COLUMN notif_prefs SET DEFAULT '{
    "events": true, "groups": true, "specialists": true, "milk_hub": true,
    "articles": true, "ai": true, "promotions": false, "newsletter": false,
    "trending": true,
    "quiet_hours": {"enabled": false, "start_hour": 22, "end_hour": 7, "tz": "America/New_York"}
  }'::jsonb;

UPDATE public.users
   SET notif_prefs = notif_prefs || '{"trending": true}'::jsonb
 WHERE NOT (notif_prefs ? 'trending');
```

- [ ] **Step 2: Apply locally**

Run: `cd "/Users/gp/The Village App/village-app" && supabase db reset`
Expected: no errors; the full 105 migration (both tasks' SQL, now one file) applies cleanly.

- [ ] **Step 3: Verify `get_trending_issue` hydration + `list_pending_review` filtering**

```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2 | tr -d '"')" -c "
INSERT INTO trending_issues (issue_date, title, intro) VALUES ('2026-07-21', 'Issue T', 'Intro T') RETURNING id;
"
```
Note the id, then insert one `is_medical_claim=false` item and one `is_medical_claim=true` item (reuse the allowlisted URLs from Task 1 Step 3), set the first to `agent_cleared` and the second to `in_review`:
```bash
psql "..." -c "
UPDATE trending_items SET status='agent_cleared' WHERE issue_id='<id>' AND is_medical_claim=false;
"
```
Then as the seeded reviewer (`SET ROLE` or via the app), run `SELECT list_pending_review();` — expected: only the `is_medical_claim=true, status=in_review` row appears, with `source_table='trending_items'`. Run `SELECT get_trending_issue('<id>');` — expected: `items` array is empty (the issue isn't `published` yet). Manually flip the issue to `published` and the item to `agent_cleared`/`approved`, re-run — expected: `items` now contains the item's full localized fields.

Also verify the audit trail: as the reviewer, `SELECT approve_content_row('trending_items', '<the in_review item id>', 'test approve');` then `SELECT action, target_table, performed_by FROM admin_audit_log WHERE target_id = '<that id>' ORDER BY created_at DESC LIMIT 1;` — expected: one row, `action='approve_trending_item'`.

Clean up: `DELETE FROM trending_issues WHERE title = 'Issue T';`

- [ ] **Step 4: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add supabase/migrations/105_v7_the_buzz.sql && git commit -m "$(cat <<'EOF'
feat: extend clinical-review RPCs + add read RPCs for The Buzz

list_pending_review/approve_content_row/reject_content_row grow a
trending_items arm gated on is_medical_claim rather than item kind.
Adds get_trending_issue/list_trending_archive for public reads and
flag_trending_item_as_medical (one-way FALSE->TRUE only) so a reviewer
can pull back a mis-tagged auto-cleared item.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Extend the mobile `clinical-review.ts` API types

**Files:**
- Modify: `apps/mobile/src/api/clinical-review.ts`

- [ ] **Step 1: Add `'trending_items'` to the source-table union and the new nullable fields to `PendingReviewRow`**

Replace the top of the file (from the `ReviewableSourceTable` type through the end of `PendingReviewRow`):

```ts
export type ReviewableSourceTable =
  | 'maternal_insights'
  | 'village_supports'
  | 'week_checklists'
  | 'trending_items';

export interface PendingReviewRow {
  source_table: ReviewableSourceTable;
  row_id: string;
  week_number: number;
  category: string;             // mi.category | vs.support_type | wc.category | ti.kind
  title: string;                // wc rows: same as body_en (item_text)
  body_en: string;
  body_es: string | null;
  hero_emoji: string | null;
  requires_crisis_footer: boolean;
  cta_label: string | null;
  cta_target: string | null;
  is_essential: boolean | null;
  review_status: 'pending' | 'approved' | 'rejected' | 'draft' | 'agent_cleared' | 'in_review';
  clinical_advisor_reviewed: boolean;
  review_notes: string | null;
  created_at: string;
  // The Buzz — only populated when source_table === 'trending_items'.
  is_medical_claim: boolean | null;
  trend_source_name: string | null;
  trend_source_url: string | null;
  evidence_source_name: string | null;
  evidence_source_url: string | null;
  myth_claim_en: string | null;
  fact_en: string | null;
}
```

- [ ] **Step 2: Add `'trending_items'` to `sourceTableLabel`**

Replace the `sourceTableLabel` function:

```ts
export function sourceTableLabel(t: ReviewableSourceTable): string {
  switch (t) {
    case 'maternal_insights': return 'Insight';
    case 'village_supports':  return 'Support';
    case 'week_checklists':   return 'Checklist';
    case 'trending_items':    return 'The Buzz';
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd "/Users/gp/The Village App/village-app/apps/mobile" && pnpm tsc --noEmit`
Expected: no new errors (existing callers of `PendingReviewRow` only read fields that already existed; the new fields are additive and optional-shaped via `| null`).

- [ ] **Step 4: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add apps/mobile/src/api/clinical-review.ts && git commit -m "$(cat <<'EOF'
feat: extend clinical-review API types for trending_items

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Phase B2 — Research pipeline (Edge Functions + scheduled agents)

### Task 4: `trending-ingest` Edge Function

**Files:**
- Create: `supabase/functions/trending-ingest/index.ts`

- [ ] **Step 1: Write the function**

```ts
// trending-ingest — service-role-only ingest endpoint for The Buzz's
// Step B (sourcing + ingest) scheduled agent. Never called by the mobile
// app. Auth is a shared secret (TRENDING_INGEST_SECRET), not a Supabase
// JWT — this function is invoked by an external Claude Code agent session,
// not a signed-in user. The DB-side allowlist trigger (migration 105) is
// the real enforcement point for source URLs regardless of what this
// function's caller believes it verified.
//
// POST /functions/v1/trending-ingest
// Header: x-village-webhook-token: <TRENDING_INGEST_SECRET>
// Body: {
//   issue_date: "YYYY-MM-DD",
//   issue_title: string,
//   issue_intro: string,
//   items: [{
//     kind: "news" | "myth_buster",
//     rank: number,
//     is_medical_claim: boolean,
//     trend_source_name: string, trend_source_url: string,
//     evidence_source_name: string, evidence_source_url: string,
//     title_en: string, title_es?: string,
//     summary_en: string, summary_es?: string,
//     myth_claim_en?: string, myth_claim_es?: string,
//     fact_en?: string, fact_es?: string,
//     ask_provider_en: string, ask_provider_es?: string,
//   }]
// }

import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-village-webhook-token',
};

const TEXT_ENCODER = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = TEXT_ENCODER.encode(a);
  const bBytes = TEXT_ENCODER.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    const av = i < aBytes.length ? aBytes[i] : 0;
    const bv = i < bBytes.length ? bBytes[i] : 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}

function verifyToken(req: Request): boolean {
  const expected = Deno.env.get('TRENDING_INGEST_SECRET');
  if (!expected) return false;
  const provided = req.headers.get('x-village-webhook-token');
  if (!provided) return false;
  return timingSafeEqual(expected, provided);
}

interface IncomingItem {
  kind: 'news' | 'myth_buster';
  rank: number;
  is_medical_claim: boolean;
  trend_source_name: string;
  trend_source_url: string;
  evidence_source_name: string;
  evidence_source_url: string;
  title_en: string;
  title_es?: string;
  summary_en: string;
  summary_es?: string;
  myth_claim_en?: string;
  myth_claim_es?: string;
  fact_en?: string;
  fact_es?: string;
  ask_provider_en: string;
  ask_provider_es?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (!verifyToken(req)) {
    console.warn('[trending-ingest] rejected: bad or missing token');
    return json({ error: 'forbidden' }, 403);
  }

  let body: {
    issue_date?: string;
    issue_title?: string;
    issue_intro?: string;
    items?: IncomingItem[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { issue_date, issue_title, issue_intro, items } = body;
  if (!issue_date || !issue_title || !issue_intro || !Array.isArray(items) || items.length === 0) {
    return json({ error: 'issue_date, issue_title, issue_intro, items[] required' }, 400);
  }

  const { data: issue, error: issueErr } = await supabase
    .from('trending_issues')
    .upsert({ issue_date, title: issue_title, intro: issue_intro }, { onConflict: 'issue_date' })
    .select('id')
    .single();

  if (issueErr || !issue) {
    return json({ error: issueErr?.message ?? 'failed to upsert issue' }, 500);
  }

  const results: { rank: number; ok: boolean; reason?: string }[] = [];

  for (const item of items) {
    // Medical-claim items go straight to the human queue; non-medical
    // items land as 'draft' for trending-compliance-pass to clear.
    const initialStatus = item.is_medical_claim ? 'in_review' : 'draft';

    const { error } = await supabase.from('trending_items').insert({
      issue_id: issue.id,
      kind: item.kind,
      rank: item.rank,
      status: initialStatus,
      is_medical_claim: item.is_medical_claim,
      trend_source_name: item.trend_source_name,
      trend_source_url: item.trend_source_url,
      evidence_source_name: item.evidence_source_name,
      evidence_source_url: item.evidence_source_url,
      title_en: item.title_en,
      title_es: item.title_es ?? null,
      summary_en: item.summary_en,
      summary_es: item.summary_es ?? null,
      myth_claim_en: item.myth_claim_en ?? null,
      myth_claim_es: item.myth_claim_es ?? null,
      fact_en: item.fact_en ?? null,
      fact_es: item.fact_es ?? null,
      ask_provider_en: item.ask_provider_en,
      ask_provider_es: item.ask_provider_es ?? null,
    });

    // A rejected insert here is almost always the allowlist trigger firing
    // (off-allowlist domain) — surface the DB error message as-is so the
    // agent's sourcing step can see exactly which URL failed.
    results.push({ rank: item.rank, ok: !error, reason: error?.message });
  }

  return json({ issue_id: issue.id, results });
});
```

- [ ] **Step 2: Set the shared secret locally**

Run: `cd "/Users/gp/The Village App/village-app" && echo "TRENDING_INGEST_SECRET=$(openssl rand -hex 32)" >> supabase/.env.local`
(This file is git-ignored per the existing `.env*.local` convention used by other Edge Functions in this repo.)

- [ ] **Step 3: Serve locally and verify auth + happy path**

Run: `supabase functions serve trending-ingest --env-file supabase/.env.local`

In another terminal:
```bash
SECRET=$(grep TRENDING_INGEST_SECRET supabase/.env.local | cut -d= -f2)
curl -s -X POST http://localhost:54321/functions/v1/trending-ingest \
  -H "x-village-webhook-token: wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"issue_date":"2026-07-21","issue_title":"t","issue_intro":"t","items":[]}'
```
Expected: `{"error":"forbidden"}`, HTTP 403.

```bash
curl -s -X POST http://localhost:54321/functions/v1/trending-ingest \
  -H "x-village-webhook-token: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "issue_date":"2026-07-21","issue_title":"Test issue","issue_intro":"Test intro",
    "items":[{
      "kind":"news","rank":1,"is_medical_claim":false,
      "trend_source_name":"AP News","trend_source_url":"https://apnews.com/x",
      "evidence_source_name":"CDC","evidence_source_url":"https://cdc.gov/x",
      "title_en":"t","summary_en":"s","ask_provider_en":"a"
    }]
  }'
```
Expected: `{"issue_id":"...","results":[{"rank":1,"ok":true}]}`.

Clean up: `psql "..." -c "DELETE FROM trending_issues WHERE title = 'Test issue';"`

- [ ] **Step 4: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add supabase/functions/trending-ingest && git commit -m "$(cat <<'EOF'
feat: add trending-ingest edge function

Shared-secret-auth ingest endpoint for The Buzz's sourcing+ingest
scheduled agent. Sets initial status from is_medical_claim (in_review for
medical, draft for non-medical — the latter picked up by
trending-compliance-pass).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `trending-compliance-pass` Edge Function

**Files:**
- Create: `supabase/functions/trending-compliance-pass/index.ts`

- [ ] **Step 1: Write the function**

```ts
// trending-compliance-pass — automated brand-safety/tone/legal pass for
// The Buzz items tagged is_medical_claim=false. This is NOT a medical
// fact-check (medical-claim items always require a human, see migration
// 105's list_pending_review filter) — it checks the copy reads as
// conversational-not-directive, carries no sensational framing, and has
// no brand-safety concerns, per docs/THE_BUZZ_TRENDING.md §4/§6.
//
// POST /functions/v1/trending-compliance-pass
// Body: { mode: 'all', limit?: number } | { mode: 'item', item_id: string }
//
// Fail-soft: any AI error leaves the row 'in_review' for a human to catch
// via the normal review queue — never auto-approves on failure, and never
// silently drops a row.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a brand-safety and editorial-tone reviewer for "The Buzz," a weekly non-medical trending-topics digest inside a maternal-health app. These items have already been tagged as NOT making a health/medical claim — your job is brand safety and tone only, never medical fact-checking.

## Approve (cleared=true) when the item:
- Reads as conversational commentary, not a directive or guideline
- Has no sensational, alarming, or clickbait framing
- Is genuinely about a cultural/product/parenting trend, not a disguised medical claim
- Contains nothing that could embarrass a hospital-partner brand

## Flag (cleared=false) when ANY of:
- The copy actually does make or imply a health/medical claim (it was mis-tagged)
- Sensational or fear-based framing
- Anything that reads as an ad, MLM pitch, or off-brand content
- Copy contradicts the trend/evidence sources provided

## Output JSON only:
{
  "cleared": <boolean>,
  "rationale": "<one sentence, ≤40 chars>"
}`;

interface ItemRow {
  id: string;
  title_en: string;
  summary_en: string;
  kind: string;
  trend_source_name: string;
  evidence_source_name: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function screenOne(item: ItemRow) {
  const userPrompt = JSON.stringify({
    kind: item.kind,
    title: item.title_en,
    summary: item.summary_en,
    trend_source: item.trend_source_name,
    evidence_source: item.evidence_source_name,
  });

  let cleared = false;
  let rationale = '';
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      temperature: 0.2,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = resp.content.map((c) => (c.type === 'text' ? c.text : '')).join('').trim();
    const stripped = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(stripped);
    cleared = parsed.cleared === true;
    rationale = typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 200) : '';
  } catch (err) {
    console.warn(`trending-compliance-pass failed ${item.id}:`, (err as Error).message);
    const { error } = await supabase
      .from('trending_items')
      .update({ status: 'in_review', review_notes: 'compliance-pass ai_unavailable' })
      .eq('id', item.id)
      .eq('status', 'draft');
    return { item_id: item.id, outcome: 'in_review', reason: 'ai_unavailable', db_error: error?.message };
  }

  const nextStatus = cleared ? 'agent_cleared' : 'in_review';
  const { error } = await supabase
    .from('trending_items')
    .update({ status: nextStatus, review_notes: rationale })
    .eq('id', item.id)
    .eq('status', 'draft');

  return { item_id: item.id, outcome: nextStatus, reason: rationale, db_error: error?.message };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const mode: 'all' | 'item' = body.mode === 'item' ? 'item' : 'all';

    let items: ItemRow[] = [];
    if (mode === 'item') {
      if (!body.item_id) return json({ error: 'item_id required' }, 400);
      const { data, error } = await supabase
        .from('trending_items')
        .select('id, title_en, summary_en, kind, trend_source_name, evidence_source_name, status, is_medical_claim')
        .eq('id', body.item_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'item not found' }, 404);
      if (data.status !== 'draft' || data.is_medical_claim) {
        return json({ skipped: true, reason: `status=${data.status} is_medical_claim=${data.is_medical_claim}` });
      }
      items = [data as ItemRow];
    } else {
      const limit = Math.min(Math.max(body.limit ?? 50, 1), 200);
      const { data, error } = await supabase
        .from('trending_items')
        .select('id, title_en, summary_en, kind, trend_source_name, evidence_source_name')
        .eq('status', 'draft')
        .eq('is_medical_claim', false)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      items = (data ?? []) as ItemRow[];
    }

    const results = [];
    for (const item of items) {
      results.push(await screenOne(item));
    }

    return json({ mode, processed: results.length, results });
  } catch (err) {
    console.error('trending-compliance-pass fatal:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
```

- [ ] **Step 2: Serve locally and verify the happy path**

Run: `supabase functions serve trending-compliance-pass --env-file supabase/.env.local` (needs `ANTHROPIC_API_KEY` in that file — confirm it's already there from other AI functions; if not, add it).

Insert a `draft` / `is_medical_claim=false` item directly via `psql` (reuse the allowlisted URLs from Task 1), then:
```bash
curl -s -X POST http://localhost:54321/functions/v1/trending-compliance-pass \
  -H "Content-Type: application/json" -d '{"mode":"all"}'
```
Expected: `{"mode":"all","processed":1,"results":[{"item_id":"...","outcome":"agent_cleared"|"in_review","reason":"..."}]}`.
Verify via `psql`: `SELECT status FROM trending_items WHERE id = '<id>';` matches the returned `outcome`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add supabase/functions/trending-compliance-pass && git commit -m "$(cat <<'EOF'
feat: add trending-compliance-pass edge function

Automated brand-safety/tone pass for is_medical_claim=false items,
modeled on ai-event-screen. Fail-soft to in_review on any AI error.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `trending-publish-notify` Edge Function

**Files:**
- Create: `supabase/functions/trending-publish-notify/index.ts`
- Modify: `supabase/functions/push-notify/index.ts`

- [ ] **Step 1: Add `'trending'` to `push-notify`'s `VALID_PREF_KEYS`**

In `supabase/functions/push-notify/index.ts`, replace:

```ts
const VALID_PREF_KEYS = [
  'events',
  'groups',
  'specialists',
  'milk_hub',
  'articles',
  'ai',
  'promotions',
] as const;
```

with:

```ts
const VALID_PREF_KEYS = [
  'events',
  'groups',
  'specialists',
  'milk_hub',
  'articles',
  'ai',
  'promotions',
  'trending',
] as const;
```

- [ ] **Step 2: Write `trending-publish-notify`**

```ts
// trending-publish-notify — fires the "The Buzz — this week" push when an
// issue transitions to published (invoked by the trending_items_after_review
// trigger in migration 105 via pg_net, body: { issue_id }). Queries the
// candidate audience directly (everyone who hasn't opted out of the
// 'trending' notif_prefs key) rather than relying on push-notify's own
// filterByPrefs to build the initial list, since push-notify has no
// broadcast-to-everyone addressing mode — this function supplies the full
// external_ids list, and push-notify's central pref/quiet-hours gate still
// re-checks each one as the safety net.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const issueId: string | undefined = body.issue_id;
    if (!issueId) return json({ error: 'issue_id required' }, 400);

    const { data: issue, error: issueErr } = await supabase
      .from('trending_issues')
      .select('id, title, intro')
      .eq('id', issueId)
      .eq('status', 'published')
      .maybeSingle();
    if (issueErr) throw issueErr;
    if (!issue) return json({ skipped: true, reason: 'issue not found or not published' });

    // Candidate audience: everyone who has NOT explicitly opted out.
    // push-notify's central gate re-filters this same set on quiet hours +
    // the 'trending' key, so an absent/true value here is safe to include.
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id')
      .or('notif_prefs->>trending.is.null,notif_prefs->>trending.eq.true');
    if (usersErr) throw usersErr;

    const externalIds = (users ?? []).map((u: { id: string }) => u.id);
    if (externalIds.length === 0) {
      return json({ skipped: true, reason: 'no_candidates' });
    }

    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        external_ids: externalIds,
        title: 'the buzz — this week',
        body: issue.title,
        url: 'village://home/the-buzz',
        data: { kind: 'the_buzz_published', issue_id: issue.id },
        pref_key: 'trending',
        respect_quiet_hours: true,
      }),
    });
    const pushResult = await res.json().catch(() => ({}));

    return json({ ok: true, notified_candidates: externalIds.length, push_result: pushResult });
  } catch (err) {
    console.error('trending-publish-notify fatal:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
```

- [ ] **Step 3: Serve locally and verify**

Run both locally: `supabase functions serve push-notify --env-file supabase/.env.local &` and `supabase functions serve trending-publish-notify --env-file supabase/.env.local`.

Insert + publish a test issue (reuse the flow from Task 1 Step 4 to get a `published` issue), then:
```bash
curl -s -X POST http://localhost:54321/functions/v1/trending-publish-notify \
  -H "Content-Type: application/json" -d '{"issue_id":"<id>"}'
```
Expected (with no `ONESIGNAL_APP_ID`/`ONESIGNAL_API_KEY` set locally, matching how other push-touching functions behave in local dev): the OneSignal call itself fails, but the response still shows `notified_candidates` > 0 and `push_result` containing the OneSignal error — confirming the audience-selection logic worked correctly up to the point of the actual network call. Clean up test rows.

- [ ] **Step 4: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add supabase/functions/trending-publish-notify supabase/functions/push-notify/index.ts && git commit -m "$(cat <<'EOF'
feat: add trending-publish-notify + trending push-notify pref key

Builds the broadcast candidate list (push-notify has no built-in
broadcast-to-everyone mode) and delegates to push-notify's existing
central pref/quiet-hours gate as the safety net.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Register the two weekly scheduled research agents

**Files:**
- Modify: `docs/VILLIE_AGENTS.md`

This task has no code to write — it registers two Claude Code scheduled tasks (same mechanism as the existing 3 audit agents documented in `docs/VILLIE_AGENTS.md`, backed by Claude's native Scheduled Tasks feature, not a repo cron file) and documents them the same way.

- [ ] **Step 1: Create the discovery agent (Step A)**

Use the `schedule` skill (or the app's Scheduled sidebar) to create a new weekly scheduled task:
- **Name:** `villie-buzz-discovery-weekly`
- **Schedule:** Mondays ~8:00am (before the existing 9am compliance audit, so it doesn't compete for attention)
- **Prompt:**
```
Weekly discovery step for The Buzz (village-app/docs/THE_BUZZ_TRENDING.md).
Install and run last30days-skill scoped ONLY to its zero-config sources
(Reddit, Hacker News, Polymarket, GitHub, web — do NOT enable X/TikTok/
Instagram/LinkedIn, they require auth this agent must never hold). Research:
"what are moms/pregnant women/new parents actually talking about in the
last 30 days" — surface 4-6 candidate trending topics relevant to
pregnancy, postpartum, infant care, or parenting culture. This step has NO
database credentials and must never attempt to write to Supabase. Write
your output as a plain markdown list of candidate topics (one line each:
topic + one-sentence why-its-trending) to
village-app/docs/audits/buzz-discovery-YYYY-MM-DD.md — nothing else. Do
not draft any article copy, do not cite sources yet — that is a separate
step's job.
```

- [ ] **Step 2: Create the sourcing + ingest agent (Step B)**

- **Name:** `villie-buzz-sourcing-ingest-weekly`
- **Schedule:** Mondays ~8:30am (30 min after Step A, so its report file exists)
- **Prompt:**
```
Weekly sourcing+ingest step for The Buzz (village-app/docs/THE_BUZZ_TRENDING.md).
Read today's village-app/docs/audits/buzz-discovery-YYYY-MM-DD.md (written
by the earlier discovery step) for candidate topics. You do NOT have
last30days-skill and must not install or use it. For each of the top 4
candidate topics (aim for 3 you'll mark as "news" + 1 as "myth_buster"),
use WebSearch/WebFetch restricted ONLY to these domains: trend-tier —
apnews.com, reuters.com, nytimes.com, washingtonpost.com, motherly.com,
parents.com, romper.com; evidence-tier — acog.org, aap.org, cdc.gov,
who.int, nih.gov, pubmed.ncbi.nlm.nih.gov, llli.org. For each topic, find
one trend-tier article and one evidence-tier grounding source (both must
be from the lists above — if you can't find a real, live URL on an
allowlisted domain for a topic, drop that topic; never fabricate a URL).
Decide is_medical_claim per item: default true; set false ONLY when the
item has zero health/medical content (pure culture/product/parenting-
logistics trend). Write copy in the V10 Gen Z voice
(village-app/docs/V10_GENZ_REBRAND.md) — lowercase, casual, group-chat
tone — for title/summary/ask_provider/myth_claim/fact fields; do NOT write
the standing disclaimer, that's fixed app copy. Then POST the finished
issue to https://<PROJECT_REF>.supabase.co/functions/v1/trending-ingest
with header x-village-webhook-token: <TRENDING_INGEST_SECRET> and the JSON
body shape documented in supabase/functions/trending-ingest/index.ts.
Report back which items were accepted vs rejected by the allowlist trigger.
```
Fill in `<PROJECT_REF>` and `<TRENDING_INGEST_SECRET>` with the actual hosted values before saving (the secret must also be set in Supabase Edge Function Secrets, not just `supabase/.env.local` — see the Ops Runbook for how existing shared-secret functions like `perks-redemption-webhook` do this).

- [ ] **Step 3: Add rows to `docs/VILLIE_AGENTS.md`'s cadence table**

In the `## Cadence (LIVE — wired 2026-07-07)` table, add two rows following the exact existing format:

```
| `villie-buzz-discovery-weekly` | `last30days-skill` (no agent persona — direct skill invocation) | Mondays ~8am | `docs/audits/buzz-discovery-YYYY-MM-DD.md` | Candidate trending topics for The Buzz — discovery only, no DB write |
| `villie-buzz-sourcing-ingest-weekly` | none — direct WebSearch/WebFetch + trending-ingest POST | Mondays ~8:30am | (posts directly to trending_items via trending-ingest; no markdown report) | Allowlist-constrained sourcing + ingest for The Buzz, holds TRENDING_INGEST_SECRET |
```

Note directly below the table (these two are NOT read-only, unlike the original 3):
```
**Note:** unlike the 3 audit agents above, the Buzz sourcing+ingest agent DOES write — it POSTs to `trending-ingest`,
which inserts draft/in_review rows into `trending_items`. It never publishes anything itself; every medical-claim
item still waits on a human via ClinicalReviewScreen, and every insert is allowlist-checked at the DB layer
regardless of what the agent's research believed it verified.
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add docs/VILLIE_AGENTS.md && git commit -m "$(cat <<'EOF'
docs: register the two weekly Buzz research scheduled agents

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Phase B3 — Review surface

### Task 8: Extend `ClinicalReviewScreen` for `trending_items`

**Files:**
- Modify: `apps/mobile/src/screens/internal/ClinicalReviewScreen.tsx`

- [ ] **Step 1: Add a Buzz-specific detail block inside `ReviewCard`**

In `ClinicalReviewScreen.tsx`, find the `ReviewCard` function's `ctaRow` block (the `{row.cta_label || row.cta_target ? (...) : null}` section) and add a new block immediately after it, before `statusRow`:

```tsx
      {row.source_table === 'trending_items' ? (
        <View style={s.buzzBlock}>
          <Text style={s.buzzLabel}>TREND SOURCE</Text>
          <Text style={s.buzzUrl} selectable numberOfLines={1}>{row.trend_source_url}</Text>
          <Text style={s.buzzLabel}>EVIDENCE SOURCE</Text>
          <Text style={s.buzzUrl} selectable numberOfLines={1}>{row.evidence_source_url}</Text>
          {row.myth_claim_en ? (
            <>
              <Text style={s.buzzLabel}>MYTH CLAIM</Text>
              <Text style={s.bodyTxt} selectable>{row.myth_claim_en}</Text>
              <Text style={s.buzzLabel}>FACT</Text>
              <Text style={s.bodyTxt} selectable>{row.fact_en}</Text>
            </>
          ) : null}
        </View>
      ) : null}
```

- [ ] **Step 2: Add the matching styles**

In the `StyleSheet.create` block at the bottom of the file, add (near `ctaRow`/`ctaLabel`/`ctaTxt`):

```ts
  buzzBlock: {
    marginTop: 10,
    padding: 8,
    backgroundColor: COLORS.cream,
    borderRadius: 8,
    gap: 2,
  },
  buzzLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    color: COLORS.barkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 6,
  },
  buzzUrl: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.coco,
  },
```

- [ ] **Step 3: Add a "recently auto-cleared" flag section below the main review list**

In the component body, add new state near the existing `rows`/`loading` state:

```tsx
  const [clearedRows, setClearedRows] = useState<
    { id: string; issue_id: string; kind: string; title_en: string; summary_en: string; trend_source_url: string; evidence_source_url: string; created_at: string }[]
  >([]);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
```

Extend the `load` callback to also fetch this list:

```tsx
  const load = useCallback(async () => {
    setError(null);
    try {
      const [pending, cleared] = await Promise.all([
        clinicalReviewApi.listPending(),
        supabase.rpc('list_recent_agent_cleared_trending_items').then((r) => r.data ?? []),
      ]);
      setRows(pending);
      setClearedRows(cleared);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load pending review queue.');
    }
  }, []);
```

Add the import at the top of the file: `import { supabase } from '@/lib/supabase';`

Add a `flagAsMedical` handler alongside `approve`/`reject`:

```tsx
  async function flagAsMedical(id: string) {
    setFlaggingId(id);
    try {
      await supabase.rpc('flag_trending_item_as_medical', { p_id: id, p_notes: 'flagged from recently-cleared list' });
      setClearedRows((cur) => cur.filter((r) => r.id !== id));
      await load(); // pulls the newly-in_review item into the main pending list
    } catch (e: any) {
      Alert.alert('Flag failed', e?.message ?? 'Unknown error');
    } finally {
      setFlaggingId(null);
    }
  }
```

Render the section in the main `ScrollView`, after the `grouped.map(...)` block and before the closing `</>`:

```tsx
            {clearedRows.length > 0 ? (
              <View style={s.weekBlock}>
                <Text style={s.weekHeading}>Recently auto-cleared — The Buzz</Text>
                <Text style={s.helpTxt}>
                  Non-medical items that auto-cleared without human review. Flag one if it actually touches a
                  health/medical claim.
                </Text>
                {clearedRows.map((r) => (
                  <View key={r.id} style={s.cardBlock}>
                    <Text style={s.cardTitle} selectable>{r.title_en}</Text>
                    <Text style={s.bodyTxt} selectable>{r.summary_en}</Text>
                    <TouchableOpacity
                      style={[s.rejectBtn, flaggingId === r.id && s.btnDisabled]}
                      onPress={() => flagAsMedical(r.id)}
                      disabled={flaggingId === r.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Flag ${r.title_en} as medical`}
                    >
                      {flaggingId === r.id
                        ? <ActivityIndicator color={COLORS.cocoDeep} />
                        : <Text style={s.rejectBtnTxt}>🚩 Flag as medical</Text>}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
```

- [ ] **Step 4: Typecheck**

Run: `cd "/Users/gp/The Village App/village-app/apps/mobile" && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add apps/mobile/src/screens/internal/ClinicalReviewScreen.tsx && git commit -m "$(cat <<'EOF'
feat: extend ClinicalReviewScreen for The Buzz

Renders trend/evidence source links + myth/fact block for trending_items
rows, and adds a "recently auto-cleared" section with a one-way flag
action so a mis-tagged non-medical item can be pulled back into review.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Phase B4 — Publish surfaces: client API, screens, Home card, notif pref

### Task 9: `theBuzz.ts` client API

**Files:**
- Create: `apps/mobile/src/api/theBuzz.ts`

- [ ] **Step 1: Write the file**

```ts
// The Buzz — client API. Reads flow entirely through get_trending_issue /
// list_trending_archive (both plain SELECT-shaped RPCs — RLS on
// trending_issues/trending_items is the actual gate; the RPCs exist only
// to hydrate the nested items array in one round trip).
import { supabase } from '@/lib/supabase';

export type TheBuzzItemKind = 'news' | 'myth_buster';

export interface TheBuzzItem {
  id: string;
  kind: TheBuzzItemKind;
  rank: number;
  title_en: string;
  title_es: string | null;
  summary_en: string;
  summary_es: string | null;
  myth_claim_en: string | null;
  myth_claim_es: string | null;
  fact_en: string | null;
  fact_es: string | null;
  ask_provider_en: string;
  ask_provider_es: string | null;
  trend_source_name: string;
  trend_source_url: string;
  evidence_source_name: string;
  evidence_source_url: string;
}

export interface TheBuzzIssue {
  id: string;
  issue_date: string;
  title: string;
  intro: string;
  published_at: string;
  items: TheBuzzItem[];
}

export interface TheBuzzArchiveRow {
  id: string;
  issue_date: string;
  title: string;
  intro: string;
  published_at: string;
}

export const theBuzzApi = {
  async getCurrentIssue(): Promise<TheBuzzIssue | null> {
    const { data, error } = await supabase.rpc('get_trending_issue', { p_issue_id: null });
    if (error) throw new Error(error.message);
    return (data as TheBuzzIssue | null) ?? null;
  },

  async getIssueById(issueId: string): Promise<TheBuzzIssue | null> {
    const { data, error } = await supabase.rpc('get_trending_issue', { p_issue_id: issueId });
    if (error) throw new Error(error.message);
    return (data as TheBuzzIssue | null) ?? null;
  },

  async listArchive(): Promise<TheBuzzArchiveRow[]> {
    const { data, error } = await supabase.rpc('list_trending_archive');
    if (error) throw new Error(error.message);
    return (data ?? []) as TheBuzzArchiveRow[];
  },
};
```

- [ ] **Step 2: Typecheck**

Run: `cd "/Users/gp/The Village App/village-app/apps/mobile" && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add apps/mobile/src/api/theBuzz.ts && git commit -m "$(cat <<'EOF'
feat: add theBuzz client API

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: i18n keys for The Buzz + archive + notif pref + Home card

**Files:**
- Modify: `apps/mobile/src/i18n/en.json`
- Modify: `apps/mobile/src/i18n/es.json`

- [ ] **Step 1: Add the `theBuzz` and `buzzArchive` top-level sections + `notifPrefs.rowTrending*` + `home.buzzCard*` keys to `en.json`**

Add these keys anywhere at the top level of `en.json` (matching the flat-namespace convention — one top-level key per feature):

```json
"theBuzz": {
  "title": "the buzz",
  "trendingEyebrow": "trending this week",
  "mythEyebrow": "myth vs fact",
  "factLabel": "what's actually known",
  "groundedIn": "grounded in {{source}} →",
  "viaSource": "via {{source}} →",
  "evidenceLinkA11y": "Open source: {{source}}",
  "trendLinkA11y": "Open source: {{source}}",
  "disclaimer": "This is what's being talked about — not medical advice. Always check with your provider.",
  "emptyTitle": "nothing buzzing yet",
  "emptyBody": "check back soon — a new issue drops weekly.",
  "loadError": "Couldn't load this week's issue. Please try again."
},
"buzzArchive": {
  "title": "the buzz — archive",
  "emptyTitle": "no past issues yet",
  "emptyBody": "once the first issue publishes, it'll show up here."
}
```

Add these two keys inside the existing `home` section (alongside `feedEventsHeader`/`feedPerksHeader`):

```json
"buzzCardTitle": "the buzz is here",
"buzzCardSub": "this week's trending topics →"
```

Add these three keys inside the existing `notifPrefs` section (alongside `rowPromotions*`):

```json
"rowTrendingTitle": "the buzz",
"rowTrendingDesc": "A weekly nudge when this week's trending-topics issue drops."
```

- [ ] **Step 2: Add the matching Spanish keys to `es.json`** (clinician-grade tone per the i18n standard; the disclaimer stays sober in both languages)

```json
"theBuzz": {
  "title": "the buzz",
  "trendingEyebrow": "de lo que se habla esta semana",
  "mythEyebrow": "mito vs realidad",
  "factLabel": "lo que realmente se sabe",
  "groundedIn": "basado en {{source}} →",
  "viaSource": "vía {{source}} →",
  "evidenceLinkA11y": "Abrir fuente: {{source}}",
  "trendLinkA11y": "Abrir fuente: {{source}}",
  "disclaimer": "Esto es de lo que se está hablando — no es consejo médico. Consulta siempre con tu proveedor.",
  "emptyTitle": "todavía no hay nada",
  "emptyBody": "vuelve pronto — cada semana sale una edición nueva.",
  "loadError": "No pudimos cargar la edición de esta semana. Intenta de nuevo."
},
"buzzArchive": {
  "title": "the buzz — archivo",
  "emptyTitle": "aún no hay ediciones pasadas",
  "emptyBody": "en cuanto se publique la primera edición, aparecerá aquí."
}
```

Add to `home`:
```json
"buzzCardTitle": "ya llegó the buzz",
"buzzCardSub": "los temas de la semana →"
```

Add to `notifPrefs`:
```json
"rowTrendingTitle": "the buzz",
"rowTrendingDesc": "Un aviso semanal cuando sale la edición de temas de la semana."
```

- [ ] **Step 3: Validate both JSON files parse**

Run: `cd "/Users/gp/The Village App/village-app/apps/mobile/src/i18n" && node -e "JSON.parse(require('fs').readFileSync('en.json')); JSON.parse(require('fs').readFileSync('es.json')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 4: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add apps/mobile/src/i18n/en.json apps/mobile/src/i18n/es.json && git commit -m "$(cat <<'EOF'
feat: add i18n keys for The Buzz

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `TheBuzzScreen`

**Files:**
- Create: `apps/mobile/src/screens/home/TheBuzzScreen.tsx`
- Modify: `apps/mobile/src/navigation/HomeNavigator.tsx`

- [ ] **Step 1: Write the screen**

```tsx
// TheBuzzScreen — weekly editorial "what the village is talking about"
// surface. Renders the current published issue when no issueId param is
// given, or a specific archived issue when one is (BuzzArchiveScreen links
// here with { issueId }). Every item pairs a trend source with a grounding
// source; the standing disclaimer is the one piece of copy on this screen
// that stays sober rather than V10 Gen Z voice (docs/THE_BUZZ_TRENDING.md §2).
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { BackButton } from '@components/shared/BackButton';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { theBuzzApi, type TheBuzzIssue, type TheBuzzItem } from '@api/theBuzz';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

type Route = RouteProp<HomeStackParamList, 'TheBuzz'>;

function localized(item: TheBuzzItem, field: 'title' | 'summary' | 'myth_claim' | 'fact' | 'ask_provider', lang: 'en' | 'es'): string {
  const en = (item as any)[`${field}_en`] as string | null;
  const es = (item as any)[`${field}_es`] as string | null;
  return (lang === 'es' ? es : en) ?? en ?? '';
}

export default function TheBuzzScreen() {
  const route = useRoute<Route>();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';

  const [issue, setIssue] = React.useState<TheBuzzIssue | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = route.params?.issueId
          ? await theBuzzApi.getIssueById(route.params.issueId)
          : await theBuzzApi.getCurrentIssue();
        if (!cancelled) setIssue(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? t('theBuzz.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // `t` is intentionally excluded — useT() returns a new closure every
    // render (no memoization), so including it here would refetch on every
    // render (infinite loop). Only issueId should retrigger the fetch.
  }, [route.params?.issueId]);

  const newsItems = (issue?.items ?? []).filter((i) => i.kind === 'news');
  const mythItem = (issue?.items ?? []).find((i) => i.kind === 'myth_buster');

  return (
    <View style={s.container}>
      <View style={s.header}>
        <BackButton color={COLORS.v2_cinnamon} />
        <Text style={s.headerTitle}>{t('theBuzz.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={COLORS.v2_cinnamon} /></View>
      ) : error ? (
        <View style={s.center}><Text style={s.errorText}>{error}</Text></View>
      ) : !issue ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>🐝</Text>
          <Text style={s.emptyTitle}>{t('theBuzz.emptyTitle')}</Text>
          <Text style={s.emptyBody}>{t('theBuzz.emptyBody')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.disclaimer}>{t('theBuzz.disclaimer')}</Text>

          <Text style={s.issueTitle}>{issue.title}</Text>
          <Text style={s.issueIntro}>{issue.intro}</Text>

          {newsItems.map((item) => (
            <BuzzNewsCard key={item.id} item={item} lang={lang} t={t} />
          ))}

          {mythItem ? <BuzzMythCard item={mythItem} lang={lang} t={t} /> : null}
        </ScrollView>
      )}
    </View>
  );
}

function BuzzNewsCard({ item, lang, t }: { item: TheBuzzItem; lang: 'en' | 'es'; t: (k: string, p?: any) => string }) {
  return (
    <View style={s.card}>
      <Text style={s.cardEyebrow}>{t('theBuzz.trendingEyebrow')}</Text>
      <Text style={s.cardTitle}>{localized(item, 'title', lang)}</Text>
      <Text style={s.cardBody}>{localized(item, 'summary', lang)}</Text>
      <TouchableOpacity onPress={() => Linking.openURL(item.evidence_source_url)} accessibilityRole="link" accessibilityLabel={t('theBuzz.evidenceLinkA11y', { source: item.evidence_source_name })}>
        <Text style={s.sourceLink}>{t('theBuzz.groundedIn', { source: item.evidence_source_name })}</Text>
      </TouchableOpacity>
      <Text style={s.askProvider}>{localized(item, 'ask_provider', lang)}</Text>
      <TouchableOpacity onPress={() => Linking.openURL(item.trend_source_url)} accessibilityRole="link" accessibilityLabel={t('theBuzz.trendLinkA11y', { source: item.trend_source_name })}>
        <Text style={s.trendSource}>{t('theBuzz.viaSource', { source: item.trend_source_name })}</Text>
      </TouchableOpacity>
    </View>
  );
}

function BuzzMythCard({ item, lang, t }: { item: TheBuzzItem; lang: 'en' | 'es'; t: (k: string, p?: any) => string }) {
  return (
    <View style={[s.card, s.mythCard]}>
      <Text style={s.cardEyebrow}>{t('theBuzz.mythEyebrow')}</Text>
      <Text style={s.mythClaim}>{localized(item, 'myth_claim', lang)}</Text>
      <Text style={s.factLabel}>{t('theBuzz.factLabel')}</Text>
      <Text style={s.cardBody}>{localized(item, 'fact', lang)}</Text>
      <TouchableOpacity onPress={() => Linking.openURL(item.evidence_source_url)} accessibilityRole="link" accessibilityLabel={t('theBuzz.evidenceLinkA11y', { source: item.evidence_source_name })}>
        <Text style={s.sourceLink}>{t('theBuzz.groundedIn', { source: item.evidence_source_name })}</Text>
      </TouchableOpacity>
      <Text style={s.askProvider}>{localized(item, 'ask_provider', lang)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.v2_cream },
  header: {
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.v2_cream,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.13)',
  },
  headerTitle: { fontFamily: FONTS.v2_bold, fontSize: 17, color: COLORS.v2_cocoa },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  errorText: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_cocoa, textAlign: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontFamily: FONTS.v2_bold, fontSize: 18, color: COLORS.v2_cocoa, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, textAlign: 'center', lineHeight: 20, marginTop: 4 },

  scroll: { padding: 20, paddingBottom: 48, gap: 14 },
  disclaimer: {
    fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 18, color: COLORS.v2_walnut,
    backgroundColor: COLORS.v2_parchment, padding: 12, borderRadius: 12,
  },
  issueTitle: { fontFamily: FONTS.v2_display, fontSize: 22, color: COLORS.v2_cocoa, marginTop: 4 },
  issueIntro: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, lineHeight: 20 },

  card: {
    backgroundColor: COLORS.v2_card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(217,108,136,0.18)', gap: 8,
  },
  mythCard: { backgroundColor: '#FDECEF', borderColor: 'rgba(194,85,111,0.25)' },
  cardEyebrow: { fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.2, color: COLORS.v2_cinnamon, textTransform: 'uppercase' },
  cardTitle: { fontFamily: FONTS.v2_display, fontSize: 17, color: COLORS.v2_cocoa },
  cardBody: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, lineHeight: 20 },
  mythClaim: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, lineHeight: 20, fontStyle: 'italic' },
  factLabel: { fontFamily: FONTS.v2_bold, fontSize: 11, letterSpacing: 0.6, color: COLORS.v2_cocoa, textTransform: 'uppercase' },
  sourceLink: { fontFamily: FONTS.v2_link, fontSize: 12.5, color: COLORS.v2_cinnamon },
  askProvider: { fontFamily: FONTS.v2_body, fontSize: 13, color: COLORS.v2_cocoa, backgroundColor: COLORS.v2_parchment, padding: 10, borderRadius: 10 },
  trendSource: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: COLORS.v2_walnut },
});
```

- [ ] **Step 2: Wire the route into `HomeNavigator.tsx`**

Add the import near the other `@screens/home/*` imports:

```tsx
import TheBuzzScreen from '@screens/home/TheBuzzScreen';
```

Add to `HomeStackParamList` (after `DiscoverHome: undefined;`):

```tsx
  TheBuzz: { issueId?: string } | undefined;
```

Add the screen registration inside `Stack.Navigator` (after `<Stack.Screen name="DiscoverHome" ... />`):

```tsx
      <Stack.Screen name="TheBuzz" component={TheBuzzScreen} />
```

- [ ] **Step 3: Typecheck**

Run: `cd "/Users/gp/The Village App/village-app/apps/mobile" && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add apps/mobile/src/screens/home/TheBuzzScreen.tsx apps/mobile/src/navigation/HomeNavigator.tsx && git commit -m "$(cat <<'EOF'
feat: add TheBuzzScreen + wire into HomeNavigator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Home card in `HomeScreenV3.tsx`

**Files:**
- Modify: `apps/mobile/src/screens/home/HomeScreenV3.tsx`

- [ ] **Step 1: Add the `TheBuzzHomeCard` component**

Add this new function right after the `DiscoverRow` function (before the `// ─── Your corner ...` comment):

```tsx
// ─── The Buzz — this week's trending-topics card ───────────────────────
function TheBuzzHomeCard({ issue, onPress }: { issue: TheBuzzArchiveRow | null; onPress: () => void }) {
  const t = useT();
  if (!issue) return null;
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.buzzCard}
      accessibilityRole="button"
      accessibilityLabel={t('home.buzzCardTitle')}
    >
      <View style={styles.buzzIcon}><Text style={{ fontSize: 19 }}>🐝</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.buzzTitle}>{t('home.buzzCardTitle')}</Text>
        <Text style={styles.buzzSub} numberOfLines={1}>{t('home.buzzCardSub')}</Text>
      </View>
    </TouchableOpacity>
  );
}
```

Add the import at the top of the file (alongside `import { homeApi, type Milestone } from '@api/home';`):

```tsx
import { theBuzzApi, type TheBuzzArchiveRow } from '@api/theBuzz';
```

- [ ] **Step 2: Fetch the current issue in the main component**

In `export default function HomeScreenV3()`, add state near `weekMilestones`:

```tsx
  const [buzzIssue, setBuzzIssue] = React.useState<TheBuzzArchiveRow | null>(null);
```

Extend the existing `useFocusEffect` block (the one that fetches `weekMilestones`) to also fetch the current Buzz issue:

```tsx
  const [weekMilestones, setWeekMilestones] = React.useState<Milestone[]>([]);
  useFocusEffect(
    React.useCallback(() => {
      setTriggerAnim((n) => n + 1);
      if (weekNumber && weekNumber >= 1 && weekNumber <= 52) {
        homeApi.getMilestonesForWeek(weekNumber)
          .then(setWeekMilestones)
          .catch(() => setWeekMilestones([]));
      }
      theBuzzApi.getCurrentIssue()
        .then((issue) => setBuzzIssue(issue))
        .catch(() => setBuzzIssue(null));
      return () => {};
    }, [weekNumber]),
  );
```

- [ ] **Step 3: Render the card**

Insert the card right after `<DiscoverRow ... />` and before `<MomCornerCard ... />` in the render tree:

```tsx
        <TheBuzzHomeCard
          issue={buzzIssue}
          onPress={() => navigation.navigate('TheBuzz', buzzIssue ? { issueId: buzzIssue.id } : undefined)}
        />

        <MomCornerCard onPress={() => navigation.navigate('MomHub' as never)} />
```

- [ ] **Step 4: Add the styles**

In the `StyleSheet.create` block, add right after `planDaySub:` (mirroring `planDayCard`'s shape):

```ts
  buzzCard: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FDECEF', borderRadius: 16, padding: 15,
    borderWidth: 1, borderColor: 'rgba(194,85,111,0.25)',
  },
  buzzIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,252,246,0.7)', alignItems: 'center', justifyContent: 'center' },
  buzzTitle: { fontFamily: FONTS.v3_display, fontSize: 16, color: T.cocoa, letterSpacing: -0.3 },
  buzzSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: '#8A4A5A', marginTop: 2, lineHeight: 16 },
```

- [ ] **Step 5: Typecheck**

Run: `cd "/Users/gp/The Village App/village-app/apps/mobile" && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run and visually verify**

Start Metro + iOS simulator (per this project's usual dev flow), navigate to Home. With no published issue in the local DB, expected: no Buzz card renders (function returns `null`). Manually publish a test issue (Task 1 Step 4's flow), pull-to-refresh or refocus the Home tab, expected: the "the buzz is here" card appears between the Discover row and the Your corner card; tapping it navigates to `TheBuzzScreen` showing the test issue's items.

- [ ] **Step 7: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add apps/mobile/src/screens/home/HomeScreenV3.tsx && git commit -m "$(cat <<'EOF'
feat: add The Buzz card to HomeScreenV3

Self-contained card that fetches the current issue directly, since
HomeScreenV3 (the actually-mounted Home screen) doesn't consume the
dormant home-feed-curator card system.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: `trending` notification preference

**Files:**
- Modify: `apps/mobile/src/store/user.ts`
- Modify: `apps/mobile/src/screens/me/NotificationPreferencesScreen.tsx`

- [ ] **Step 1: Add `'trending'` to `NotifPrefKey` and `DEFAULT_NOTIF_PREFS`**

In `apps/mobile/src/store/user.ts`, replace:

```ts
export type NotifPrefKey =
  | 'events'
  | 'groups'
  | 'specialists'
  | 'milk_hub'
  | 'articles'
  | 'ai'
  | 'promotions'
  | 'newsletter';
```

with:

```ts
export type NotifPrefKey =
  | 'events'
  | 'groups'
  | 'specialists'
  | 'milk_hub'
  | 'articles'
  | 'ai'
  | 'promotions'
  | 'newsletter'
  | 'trending';
```

Replace:

```ts
export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  events: true,
  groups: true,
  specialists: true,
  milk_hub: true,
  articles: true,
  ai: true,
  promotions: false,
  newsletter: false,
  quiet_hours: DEFAULT_QUIET_HOURS,
};
```

with:

```ts
export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  events: true,
  groups: true,
  specialists: true,
  milk_hub: true,
  articles: true,
  ai: true,
  promotions: false,
  newsletter: false,
  trending: true,
  quiet_hours: DEFAULT_QUIET_HOURS,
};
```

- [ ] **Step 2: Add the toggle row**

In `apps/mobile/src/screens/me/NotificationPreferencesScreen.tsx`, add a new entry to the `ROWS` array, right after the `articles` row (grouping it with the other content-nudge surfaces, ahead of the marketing-flavored `promotions`/`newsletter` rows):

```ts
  { key: 'articles',    titleKey: 'notifPrefs.rowArticlesTitle',    descKey: 'notifPrefs.rowArticlesDesc' },
  { key: 'trending',    titleKey: 'notifPrefs.rowTrendingTitle',    descKey: 'notifPrefs.rowTrendingDesc' },
  { key: 'ai',          titleKey: 'notifPrefs.rowAiTitle',          descKey: 'notifPrefs.rowAiDesc' },
```
(This replaces the existing `articles` and `ai` lines with the same two lines plus the new `trending` line inserted between them.)

- [ ] **Step 3: Typecheck**

Run: `cd "/Users/gp/The Village App/village-app/apps/mobile" && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run and visually verify**

Navigate to Me → Preferences → Notifications. Expected: a new "the buzz" row appears between "Articles & guides" and "villie nudges", defaulting to on, toggles and persists like the other rows (optimistic write + revert-on-error, matching the existing pattern).

- [ ] **Step 5: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add apps/mobile/src/store/user.ts apps/mobile/src/screens/me/NotificationPreferencesScreen.tsx && git commit -m "$(cat <<'EOF'
feat: add trending notification preference

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Phase B5 — Manual archive

### Task 14: `BuzzArchiveScreen` + Manual entry point

**Files:**
- Create: `apps/mobile/src/screens/manual/BuzzArchiveScreen.tsx`
- Modify: `apps/mobile/src/navigation/ManualNavigator.tsx`

- [ ] **Step 1: Write the archive screen**

```tsx
// BuzzArchiveScreen — past published "The Buzz" issues, reachable from the
// Manual tab. Tapping a row opens TheBuzzScreen in archive mode ({ issueId }).
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { theBuzzApi, type TheBuzzArchiveRow } from '@api/theBuzz';

export default function BuzzArchiveScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const [rows, setRows] = React.useState<TheBuzzArchiveRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const data = await theBuzzApi.listArchive();
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const onRefresh = React.useCallback(() => { setRefreshing(true); load(); }, [load]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={s.back}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('buzzArchive.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={COLORS.v2_cinnamon} /></View>
      ) : rows.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>🐝</Text>
          <Text style={s.emptyTitle}>{t('buzzArchive.emptyTitle')}</Text>
          <Text style={s.emptyBody}>{t('buzzArchive.emptyBody')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.v2_cinnamon} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.row}
              onPress={() => navigation.navigate('TheBuzz', { issueId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Text style={s.rowDate}>{new Date(item.issue_date).toLocaleDateString()}</Text>
              <Text style={s.rowTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={s.rowIntro} numberOfLines={2}>{item.intro}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.v2_cream },
  header: {
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.v2_cream,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.13)',
  },
  back: { fontSize: 15, color: COLORS.v2_cinnamon, fontFamily: FONTS.v2_link },
  headerTitle: { fontFamily: FONTS.v2_bold, fontSize: 17, color: COLORS.v2_cocoa },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontFamily: FONTS.v2_bold, fontSize: 18, color: COLORS.v2_cocoa, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.v2_body, fontSize: 14, color: COLORS.v2_walnut, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  row: {
    backgroundColor: COLORS.v2_card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(217,108,136,0.18)', gap: 4,
  },
  rowDate: { fontFamily: FONTS.v2_mono, fontSize: 10, color: COLORS.v2_cinnamon, letterSpacing: 0.6, textTransform: 'uppercase' },
  rowTitle: { fontFamily: FONTS.v2_bold, fontSize: 15, color: COLORS.v2_cocoa },
  rowIntro: { fontFamily: FONTS.v2_body, fontSize: 13, color: COLORS.v2_walnut, lineHeight: 18 },
});
```

- [ ] **Step 2: Wire both `BuzzArchive` and `TheBuzz` into `ManualNavigator.tsx`**

`ManualNavigator` needs `TheBuzzScreen` registered too (not just `BuzzArchiveScreen`) because `BuzzArchiveScreen` navigates to `'TheBuzz'` and that route only exists in whichever stack the screen is currently mounted under — this mirrors the existing precedent in this exact file, where `WeeklyJourneyScreen`/`MilestoneDetailScreen`/`MilestoneTimelineScreen` are already registered in both `HomeNavigator` and `ManualNavigator` for the same reason.

Add the imports near the other `@screens/manual/*` imports:

```tsx
import BuzzArchiveScreen from '@screens/manual/BuzzArchiveScreen';
import TheBuzzScreen from '@screens/home/TheBuzzScreen';
```

Add the screen registrations inside `Stack.Navigator`, after `<Stack.Screen name="BeforeBaby" component={BeforeBabyScreen} />`:

```tsx
      <Stack.Screen name="BuzzArchive" component={BuzzArchiveScreen} />
      <Stack.Screen name="TheBuzz" component={TheBuzzScreen} />
```

- [ ] **Step 3: Add a Manual entry point to the archive**

`ManualScrollV3.tsx` (the mounted Manual home) has a hamburger `MenuPanel` with a `groupLibrary` `MenuGroup` containing a "Saved chapters" `MenuItem` (navigates to `'SavedManual'` via a `goToSavedChapters` helper). Add a matching entry for the Buzz archive right after it.

Add a new navigation helper next to the existing ones (around line 867):

```tsx
  const goToSavedChapters = () => navigation.navigate('SavedManual' as never);
  const goToBuzzArchive = () => navigation.navigate('BuzzArchive' as never);
```

Add a new `MenuItem` inside the `groupLibrary` `MenuGroup`, immediately after the "Saved chapters" `MenuItem`:

```tsx
          <MenuItem
            title={t('manualMenu.buzzArchive')}
            sub={t('manualMenu.buzzArchiveSub')}
            icon={MENU_ICONS.bookOpen}
            onPress={closeAnd(goToBuzzArchive)}
          />
```

Add the two new keys to the `manualMenu` section of both `en.json` and `es.json` (from Task 10's file — add these alongside `manualMenu.savedChapters`/`savedChaptersSub`):

`en.json`:
```json
"buzzArchive": "The Buzz archive",
"buzzArchiveSub": "past weekly trending-topics issues"
```

`es.json`:
```json
"buzzArchive": "Archivo de The Buzz",
"buzzArchiveSub": "ediciones pasadas de temas de la semana"
```

- [ ] **Step 4: Typecheck**

Run: `cd "/Users/gp/The Village App/village-app/apps/mobile" && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run and visually verify**

Publish 2+ test issues locally (vary `issue_date`). Navigate to Manual tab → tap the new Buzz-archive entry point. Expected: both issues list, newest first; tapping one opens `TheBuzzScreen` with that issue's items (confirms the shared-screen-across-navigators wiring works from the Manual tab, not just Home).

- [ ] **Step 6: Commit**

```bash
cd "/Users/gp/The Village App/village-app" && git add apps/mobile/src/screens/manual/BuzzArchiveScreen.tsx apps/mobile/src/navigation/ManualNavigator.tsx apps/mobile/src/screens/manual/ManualScrollV3.tsx && git commit -m "$(cat <<'EOF'
feat: add Buzz archive to Manual tab

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Post-implementation: production deploy checklist (not part of any task above — do once all 14 tasks are merged)

- [ ] `supabase db push` (or apply migration 105 via the hosted MCP) to the hosted project
- [ ] `supabase functions deploy trending-ingest --no-verify-jwt` (this function has zero Supabase JWT involvement — it's called by an external scheduled agent with only the `TRENDING_INGEST_SECRET` header; deploying it the default way makes the gateway 401 every call before `verifyToken` ever runs — matches the established pattern already used for `manual-og`/`gear-moderation-*`/`specialist-invite-create` in this repo)
- [ ] `supabase functions deploy trending-compliance-pass trending-publish-notify` (both invoked with a real service-role JWT, default verify-jwt posture is correct)
- [ ] Set `TRENDING_INGEST_SECRET` in Supabase Edge Function Secrets (same value used in the Step B scheduled-agent prompt)
- [ ] Confirm `ANTHROPIC_API_KEY` is available to `trending-compliance-pass` (should already be set project-wide for the other AI functions)
- [ ] Set at least one `users.is_clinical_reviewer = TRUE` reviewer (reuses the existing flag from migration 043 — no new reviewer role needed)
- [ ] Confirm the two scheduled agents (Task 7) are live and firing on the intended cadence
- [ ] OTA-publish the mobile bundle (this feature has no native dependency — fully OTA-shippable per this repo's usual pattern)
