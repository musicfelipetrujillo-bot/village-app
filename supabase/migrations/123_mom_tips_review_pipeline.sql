-- 123_mom_tips_review_pipeline.sql
--
-- THE BUG: Mama's Corner → "Mom tips" opens an empty screen for every user.
--
-- Migration 120 seeded 371 tips with `review_status='draft'` and a read RPC
-- that returns ONLY 'approved' rows — correct, deliberate, and the reason it
-- was safe to write 371 rows of daily guidance for postpartum women at all.
-- What 120-122 never shipped was the other half: a way for the clinical
-- reviewer to APPROVE any of it. `mom_tips` is absent from
-- `list_pending_review`, and `approve_content_row` / `reject_content_row`
-- reject it outright ('invalid table'). So the gate had no gate-keeper and the
-- feature could never light up — the empty state was permanent, not pending.
--
-- This migration adds the missing half:
--   1. reviewed_by / reviewed_at, so an approval is attributable (a clinical
--      gate whose decisions aren't attributable isn't much of a gate).
--   2. `list_mom_tips_for_review(week)` — the reviewer reads ONE WEEK at a
--      time. Deliberately week-scoped rather than folded into
--      `list_pending_review`: that RPC is unpaginated and 371 rows would bury
--      the (small, time-sensitive) Buzz + weekly-journey queue it exists for.
--   3. `mom_tips_review_summary()` — counts + the next week needing review, so
--      the reviewer always knows what is left and where to resume.
--   4. `approve_content_row` / `reject_content_row` extended to 'mom_tips'.
--      ⚠️ Both are reproduced IN FULL from their live `pg_get_functiondef`
--      bodies: CREATE OR REPLACE on a plpgsql function is a whole-body
--      replace, and migration 118 already shipped a silent feature revert to
--      this database by rebuilding a function from a stale ancestor.
--   5. `approve_mom_tips_week(week, notes)` — approves the seven tips of ONE
--      week in a single call. This is NOT a bulk-approve: the reviewer surface
--      renders all seven in full before the action is reachable, so the unit
--      of approval is exactly the unit that was read. There is deliberately no
--      "approve everything" call, and rejection stays strictly per row.
--
-- Nothing here approves any content. After this migration every row is still
-- 'draft' and the screen still shows its calm empty state — the difference is
-- that a reviewer can now move rows out of it.

-- ── attribution columns ─────────────────────────────────────────────────────
ALTER TABLE public.mom_tips
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- ── reviewer reads ──────────────────────────────────────────────────────────
-- One week (all locales, all statuses). SECURITY DEFINER because RLS on
-- mom_tips deliberately hides everything that isn't 'approved' from
-- `authenticated` — the reviewer is the one role that must see drafts.
CREATE OR REPLACE FUNCTION public.list_mom_tips_for_review(p_week SMALLINT)
RETURNS TABLE (
  id UUID,
  week_number SMALLINT,
  day_index SMALLINT,
  category TEXT,
  title TEXT,
  body TEXT,
  locale TEXT,
  review_status TEXT,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT t.id, t.week_number, t.day_index, t.category, t.title, t.body,
         t.locale, t.review_status, t.review_notes, t.reviewed_at
  FROM mom_tips t
  WHERE is_clinical_reviewer()
    AND t.week_number = LEAST(GREATEST(p_week, 0), 52)
  ORDER BY t.locale, t.day_index;
$$;

-- Where the reviewer stands: how much is done, and which week to open next.
-- `next_week` is the lowest week that still holds a non-approved row, so the
-- surface can resume without the reviewer tracking it themselves.
CREATE OR REPLACE FUNCTION public.mom_tips_review_summary()
RETURNS TABLE (
  total BIGINT,
  approved BIGINT,
  rejected BIGINT,
  pending BIGINT,
  next_week SMALLINT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT
    COUNT(*)                                            AS total,
    COUNT(*) FILTER (WHERE review_status = 'approved')  AS approved,
    COUNT(*) FILTER (WHERE review_status = 'rejected')  AS rejected,
    COUNT(*) FILTER (WHERE review_status NOT IN ('approved', 'rejected')) AS pending,
    MIN(week_number) FILTER (WHERE review_status NOT IN ('approved', 'rejected')) AS next_week
  FROM mom_tips
  WHERE is_clinical_reviewer();
$$;

-- ── week approval ───────────────────────────────────────────────────────────
-- Returns the number of rows moved, so the caller can tell "approved 7" from
-- "there was nothing left to approve" instead of guessing.
CREATE OR REPLACE FUNCTION public.approve_mom_tips_week(p_week SMALLINT, p_notes TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_n   INTEGER;
BEGIN
  IF NOT is_clinical_reviewer() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE mom_tips
     SET review_status = 'approved',
         clinical_advisor_reviewed = TRUE,
         reviewed_by = v_uid,
         reviewed_at = NOW(),
         review_notes = COALESCE(p_notes, review_notes),
         updated_at = NOW()
   WHERE week_number = LEAST(GREATEST(p_week, 0), 52)
     -- Never resurrects a row the reviewer already rejected.
     AND review_status IN ('draft', 'in_review');

  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- Deliberately NOT written to admin_audit_log: that table's `target_id` is
  -- NOT NULL and a week approval has no single target row, so the insert would
  -- abort the whole approval with 23502. The audit trail for tips is per-row
  -- and richer anyway — reviewed_by + reviewed_at land on each of the seven.

  RETURN v_n;
END;
$$;

-- ── approve_content_row — FULL BODY, 'mom_tips' branch added ────────────────
CREATE OR REPLACE FUNCTION public.approve_content_row(p_table text, p_id uuid, p_notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NOT is_clinical_reviewer() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_table NOT IN ('maternal_insights', 'village_supports', 'week_checklists', 'trending_items', 'mom_tips') THEN
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
  ELSIF p_table = 'mom_tips' THEN
    UPDATE mom_tips
       SET review_status = 'approved', clinical_advisor_reviewed = TRUE,
           reviewed_by = v_uid, reviewed_at = NOW(),
           review_notes = COALESCE(p_notes, review_notes), updated_at = NOW()
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
$function$;

-- ── reject_content_row — FULL BODY, 'mom_tips' branch added ─────────────────
CREATE OR REPLACE FUNCTION public.reject_content_row(p_table text, p_id uuid, p_notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NOT is_clinical_reviewer() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_notes IS NULL OR char_length(trim(p_notes)) < 3 THEN
    RAISE EXCEPTION 'rejection notes required (min 3 chars)' USING ERRCODE = '22023';
  END IF;

  IF p_table NOT IN ('maternal_insights', 'village_supports', 'week_checklists', 'trending_items', 'mom_tips') THEN
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
  ELSIF p_table = 'mom_tips' THEN
    UPDATE mom_tips
       SET review_status = 'rejected', clinical_advisor_reviewed = TRUE,
           reviewed_by = v_uid, reviewed_at = NOW(), review_notes = p_notes,
           updated_at = NOW()
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
$function$;

-- ── grants ──────────────────────────────────────────────────────────────────
-- Same posture as migrations 052/054/090: anon can reach none of it; the
-- internal `is_clinical_reviewer()` check inside each function is what
-- actually authorizes, network reachability is just narrowed to signed-in.
REVOKE ALL ON FUNCTION public.list_mom_tips_for_review(SMALLINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mom_tips_review_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_mom_tips_week(SMALLINT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_mom_tips_for_review(SMALLINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mom_tips_review_summary() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_mom_tips_week(SMALLINT, TEXT) TO authenticated, service_role;
