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
  USING (
    status IN ('approved', 'agent_cleared')
    AND EXISTS (
      SELECT 1 FROM trending_issues ti
      WHERE ti.id = trending_items.issue_id
        AND ti.status = 'published'
    )
  );

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
SET search_path = public, pg_catalog
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
SET search_path = public, pg_catalog
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
--    trending-publish-notify (deployed in a later task) — safe no-op
--    locally where pg_net/the app.* GUCs aren't configured. Also writes an
--    admin_audit_log row (schema: id, action, target_table, target_id,
--    performed_by, metadata, created_at — from migration 016).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trending_items_after_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
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
SET search_path = public, pg_catalog
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
--    Both write an admin_audit_log row (schema: id, action, target_table,
--    target_id, performed_by, metadata, created_at — from migration 016).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION approve_content_row(
  p_table TEXT,
  p_id    UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
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
SET search_path = public, pg_catalog
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
SET search_path = public, pg_catalog
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
SET search_path = public, pg_catalog
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
