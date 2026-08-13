-- 120_mom_tips.sql
-- Mom Tips — the feature that replaces the "Mom hacks" placeholder row in
-- Mama's Corner (MomHubScreen), which has been showing "soon" with nothing
-- behind it.
--
-- SHAPE: 365 tips = 7 per week × 52 weeks + 1. "Stage-based" is concrete here:
-- a tip is addressed to a specific week of her baby's life, so a mom at week 43
-- gets week-43 tips, not generic advice. day_index 0-6 gives her one per day
-- without any scheduling machinery — the day of the year picks it.
--
-- ⚠️ CLINICAL GATE (the founder's "cleanest split", 2026-08-12): tips are
-- WRITTEN here but every row lands `review_status='draft'`. The read RPC returns
-- ONLY 'approved' rows, so nothing reaches a mom until the clinical reviewer
-- passes it — the same posture as manual_videos and maternal_insights. Seeding
-- 365 rows as 'approved' would have put unreviewed guidance about feeding,
-- sleep and recovery in front of postpartum women, which is exactly the surface
-- the clinical-advisor launch gate exists to cover.
--
-- SAFETY POSTURE for the copy itself: these are practical, wellness-tier tips —
-- logistics, comfort, confidence. They never diagnose, never dose, never give a
-- threshold that competes with "call your provider". Anything that touches a
-- red-flag symptom belongs in the Manual or the Quick Reference hub, not here.

-- ── table ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mom_tips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number     SMALLINT NOT NULL CHECK (week_number BETWEEN 0 AND 52),
  day_index       SMALLINT NOT NULL CHECK (day_index BETWEEN 0 AND 6),
  -- Which part of her life it helps with. Mirrors the Manual's baby pillars
  -- plus 'you' — the mom-facing one, which is the whole point of the corner.
  category        TEXT NOT NULL CHECK (category IN ('you', 'feed', 'sleep', 'care', 'play')),
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 60),
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 320),
  locale          TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'es')),
  -- Review gate — nothing ships to a mom on 'draft'.
  review_status   TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'in_review', 'approved', 'rejected')),
  clinical_advisor_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_number, day_index, locale)
);

CREATE INDEX IF NOT EXISTS mom_tips_week_idx
  ON public.mom_tips (week_number, day_index)
  WHERE review_status = 'approved';

ALTER TABLE public.mom_tips ENABLE ROW LEVEL SECURITY;

-- Approved tips are readable by any signed-in mom. Drafts are invisible to
-- everyone except the reviewer surface (which goes through service_role).
DROP POLICY IF EXISTS mom_tips_read_approved ON public.mom_tips;
CREATE POLICY mom_tips_read_approved ON public.mom_tips
  FOR SELECT TO authenticated
  USING (review_status = 'approved');

DROP POLICY IF EXISTS mom_tips_service_all ON public.mom_tips;
CREATE POLICY mom_tips_service_all ON public.mom_tips
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── read RPCs ───────────────────────────────────────────────────────────────
-- Today's tip. Deliberately derives the day from the DATE rather than storing
-- per-user state: no streaks, no "you missed one", nothing to fall behind on —
-- the same rule Reset & Recharge follows. She opens it, there's a tip.
CREATE OR REPLACE FUNCTION public.get_mom_tip_for_today(p_week SMALLINT, p_locale TEXT DEFAULT 'en')
RETURNS TABLE (week_number SMALLINT, day_index SMALLINT, category TEXT, title TEXT, body TEXT)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT t.week_number, t.day_index, t.category, t.title, t.body
  FROM mom_tips t
  WHERE t.review_status = 'approved'
    AND t.locale = p_locale
    AND t.week_number = LEAST(GREATEST(p_week, 0), 52)
    AND t.day_index = (EXTRACT(DOY FROM CURRENT_DATE)::INT % 7)
  LIMIT 1;
$$;

-- The week's set, so she can read ahead or catch up without it being a chore.
CREATE OR REPLACE FUNCTION public.list_mom_tips_for_week(p_week SMALLINT, p_locale TEXT DEFAULT 'en')
RETURNS TABLE (day_index SMALLINT, category TEXT, title TEXT, body TEXT)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT t.day_index, t.category, t.title, t.body
  FROM mom_tips t
  WHERE t.review_status = 'approved'
    AND t.locale = p_locale
    AND t.week_number = LEAST(GREATEST(p_week, 0), 52)
  ORDER BY t.day_index;
$$;

-- Reviewer surface: how many are waiting, so the queue is visible.
CREATE OR REPLACE FUNCTION public.mom_tips_review_counts()
RETURNS TABLE (review_status TEXT, n BIGINT)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT t.review_status, count(*) FROM mom_tips t GROUP BY t.review_status;
$$;

REVOKE EXECUTE ON FUNCTION public.get_mom_tip_for_today(SMALLINT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_mom_tip_for_today(SMALLINT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.list_mom_tips_for_week(SMALLINT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_mom_tips_for_week(SMALLINT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.mom_tips_review_counts() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mom_tips_review_counts() TO service_role;
