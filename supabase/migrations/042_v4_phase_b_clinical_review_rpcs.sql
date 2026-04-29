-- V4 Phase B — Clinical-advisor review dashboard RPCs
--
-- Three SECURITY DEFINER RPCs that power an internal-only review screen for
-- the maternal_insights / village_supports / week_checklists weekly content
-- tables. Public RLS already restricts SELECT to `review_status='approved'`,
-- so without these RPCs even the seeded test reviewer can't read pending
-- rows. This migration intentionally does NOT broaden the RLS policies —
-- read access goes through `list_pending_review()` and writes go through
-- `approve_content_row()` / `reject_content_row()`, both of which set the
-- audit trail (`reviewed_by`, `reviewed_at`, `review_notes`) atomically.
--
-- Reviewer authorization: gated on a single boolean helper
-- `is_clinical_reviewer()` that — for now — only accepts the seeded test
-- user. When a real internal-reviewer role exists (Supabase Auth claim or a
-- `users.is_clinical_reviewer` flag), swap the helper body. The RPCs do
-- not need to change.
--
-- All three RPCs run as SECURITY DEFINER so they bypass RLS for writes,
-- but every one of them re-checks `is_clinical_reviewer()` first — RLS
-- bypass is intentional, authorization is explicit.

-- ---------------------------------------------------------------------------
-- 1. is_clinical_reviewer() — internal authorization helper
-- ---------------------------------------------------------------------------
-- Hard-coded to the seeded test user (rey@village.test) for the MVP. Not a
-- security boundary on its own — every RPC re-checks. When the real role
-- lands, replace the SELECT body and these RPCs pick it up automatically.

CREATE OR REPLACE FUNCTION is_clinical_reviewer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = 'c16f69ae-445d-4348-83f0-592605f6ec37'::uuid;
$$;

-- ---------------------------------------------------------------------------
-- 2. list_pending_review() — single feed across all 3 tables
-- ---------------------------------------------------------------------------
-- Returns every row where `clinical_advisor_reviewed=FALSE` regardless of
-- review_status, so a reviewer can see freshly-AI-generated content (pending)
-- AND content the cron already approved but the clinician hasn't signed off
-- on yet. ES translation is co-loaded from each table's i18n sibling so the
-- reviewer sees both EN + ES side-by-side in one call.
--
-- Sort: oldest week first, then crisis-flagged rows ahead of regular rows
-- inside the same week (so postpartum-mood-style rows surface fast).

CREATE OR REPLACE FUNCTION list_pending_review()
RETURNS TABLE (
  source_table             TEXT,
  row_id                   UUID,
  week_number              INTEGER,
  category                 TEXT,      -- mi.category / vs.support_type / wc.category
  title                    TEXT,      -- wc has no title — falls back to item_text
  body_en                  TEXT,
  body_es                  TEXT,
  hero_emoji               TEXT,
  requires_crisis_footer   BOOLEAN,
  cta_label                TEXT,
  cta_target               TEXT,
  is_essential             BOOLEAN,
  review_status            TEXT,
  clinical_advisor_reviewed BOOLEAN,
  review_notes             TEXT,
  created_at               TIMESTAMPTZ
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
    'maternal_insights'::TEXT       AS source_table,
    mi.id                           AS row_id,
    mi.week_number,
    mi.category,
    mi.title,
    mi.body                         AS body_en,
    mi_es.body                      AS body_es,
    mi.hero_emoji,
    mi.requires_crisis_footer,
    NULL::TEXT                      AS cta_label,
    NULL::TEXT                      AS cta_target,
    NULL::BOOLEAN                   AS is_essential,
    mi.review_status,
    mi.clinical_advisor_reviewed,
    mi.review_notes,
    mi.created_at
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
    vs.support_type                 AS category,
    vs.title,
    vs.body,
    vs_es.body,
    vs.hero_emoji,
    FALSE                           AS requires_crisis_footer,
    vs.cta_label,
    vs.cta_target,
    NULL::BOOLEAN,
    vs.review_status,
    vs.clinical_advisor_reviewed,
    vs.review_notes,
    vs.created_at
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
    wc.item_text                    AS title,
    wc.item_text                    AS body_en,
    wc_es.item_text                 AS body_es,
    NULL::TEXT,
    FALSE,
    NULL::TEXT,
    NULL::TEXT,
    wc.is_essential,
    wc.review_status,
    wc.clinical_advisor_reviewed,
    wc.review_notes,
    wc.created_at
  FROM week_checklists wc
  LEFT JOIN week_checklists_i18n wc_es
    ON wc_es.checklist_item_id = wc.id AND wc_es.locale = 'es'
  WHERE (SELECT ok FROM allowed)
    AND wc.clinical_advisor_reviewed = FALSE

  ORDER BY week_number ASC, requires_crisis_footer DESC NULLS LAST, source_table, created_at ASC;
$$;

-- ---------------------------------------------------------------------------
-- 3. approve_content_row(p_table, p_id, p_notes) — single-row approve
-- ---------------------------------------------------------------------------
-- Sets clinical_advisor_reviewed=TRUE, review_status='approved', stamps
-- reviewed_by/reviewed_at, optionally appends notes. Approved rows immediately
-- become public-readable via the existing RLS policies (review_status filter).
--
-- p_table is validated against an explicit allowlist so a malformed call
-- can't dynamic-SQL into an unintended table.

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

  IF p_table NOT IN ('maternal_insights', 'village_supports', 'week_checklists') THEN
    RAISE EXCEPTION 'invalid table: %', p_table USING ERRCODE = '22023';
  END IF;

  IF p_table = 'maternal_insights' THEN
    UPDATE maternal_insights
       SET review_status              = 'approved',
           clinical_advisor_reviewed  = TRUE,
           reviewed_by                = v_uid,
           reviewed_at                = NOW(),
           review_notes               = p_notes
     WHERE id = p_id;
  ELSIF p_table = 'village_supports' THEN
    UPDATE village_supports
       SET review_status              = 'approved',
           clinical_advisor_reviewed  = TRUE,
           reviewed_by                = v_uid,
           reviewed_at                = NOW(),
           review_notes               = p_notes
     WHERE id = p_id;
  ELSE
    UPDATE week_checklists
       SET review_status              = 'approved',
           clinical_advisor_reviewed  = TRUE,
           reviewed_by                = v_uid,
           reviewed_at                = NOW(),
           review_notes               = p_notes
     WHERE id = p_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found in %: %', p_table, p_id USING ERRCODE = '02000';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. reject_content_row(p_table, p_id, p_notes) — single-row reject
-- ---------------------------------------------------------------------------
-- Sets review_status='rejected', clinical_advisor_reviewed=TRUE so the row
-- drops out of the pending feed. Public RLS only exposes `approved`, so a
-- rejected row is invisible to end users. Notes REQUIRED on reject (the
-- audit trail needs the reason — re-generation prompts depend on it).

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

  IF p_table NOT IN ('maternal_insights', 'village_supports', 'week_checklists') THEN
    RAISE EXCEPTION 'invalid table: %', p_table USING ERRCODE = '22023';
  END IF;

  IF p_table = 'maternal_insights' THEN
    UPDATE maternal_insights
       SET review_status              = 'rejected',
           clinical_advisor_reviewed  = TRUE,
           reviewed_by                = v_uid,
           reviewed_at                = NOW(),
           review_notes               = p_notes
     WHERE id = p_id;
  ELSIF p_table = 'village_supports' THEN
    UPDATE village_supports
       SET review_status              = 'rejected',
           clinical_advisor_reviewed  = TRUE,
           reviewed_by                = v_uid,
           reviewed_at                = NOW(),
           review_notes               = p_notes
     WHERE id = p_id;
  ELSE
    UPDATE week_checklists
       SET review_status              = 'rejected',
           clinical_advisor_reviewed  = TRUE,
           reviewed_by                = v_uid,
           reviewed_at                = NOW(),
           review_notes               = p_notes
     WHERE id = p_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'row not found in %: %', p_table, p_id USING ERRCODE = '02000';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Indexes — match the partial-coverage already present on maternal_insights
-- ---------------------------------------------------------------------------
-- Migration 036 only indexed maternal_insights for the review dashboard.
-- Add matching indexes on the other two tables so list_pending_review()
-- doesn't seq-scan once the AI fill cron has run a few times.

CREATE INDEX IF NOT EXISTS idx_village_supports_review_dashboard
  ON village_supports(review_status, clinical_advisor_reviewed, week_number);

CREATE INDEX IF NOT EXISTS idx_week_checklists_review_dashboard
  ON week_checklists(review_status, clinical_advisor_reviewed, week_number);

-- ---------------------------------------------------------------------------
-- 6. Grants — auth role only; helper not exposed
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION list_pending_review()                              TO authenticated;
GRANT EXECUTE ON FUNCTION approve_content_row(TEXT, UUID, TEXT)              TO authenticated;
GRANT EXECUTE ON FUNCTION reject_content_row(TEXT, UUID, TEXT)               TO authenticated;
-- is_clinical_reviewer() is implicitly callable by SECURITY DEFINER bodies;
-- not granted to authenticated to keep its internal-only intent clear.
