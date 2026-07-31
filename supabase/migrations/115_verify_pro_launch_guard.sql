-- 115_verify_pro_launch_guard.sql
-- (a) Fixes a bug in 114 and (b) self-tests the guard it installs.
--
-- BUG: pro_launch_readiness() declares an OUT column named `target` via
-- RETURNS TABLE, and `pro_launch_targets` also has a column named `target`, so
-- `SELECT target FROM pro_launch_targets` raised "column reference is ambiguous"
-- at runtime — meaning the guard would have thrown on *every* attempt to flip
-- the flag, including a legitimate one. Fixed by table-qualifying the reads.
-- Caught because the self-test below actually executes the function; a guard
-- nobody runs is a guard nobody knows is broken.
--
-- The self-test re-runs on every `supabase db reset`, so a later refactor that
-- drops the trigger fails the migration chain instead of silently re-opening
-- the door.
--
-- Leaves pro_video_gate OFF in every path.

CREATE OR REPLACE FUNCTION pro_launch_readiness()
RETURNS TABLE (
  check_name TEXT,
  ok         BOOLEAN,
  actual     INT,
  target     INT,
  blocking   BOOLEAN,
  detail     TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  t_weeks    INT := (SELECT plt.target      FROM pro_launch_targets plt WHERE plt.key = 'week_intro_weeks');
  t_bucket   INT := (SELECT plt.target      FROM pro_launch_targets plt WHERE plt.key = 'min_videos_per_bucket');
  t_caption  INT := (SELECT plt.target      FROM pro_launch_targets plt WHERE plt.key = 'captions_pct');
  t_clinical INT := (SELECT plt.target      FROM pro_launch_targets plt WHERE plt.key = 'clinical_review_pct');
  b_weeks    BOOLEAN := (SELECT plt.is_blocking FROM pro_launch_targets plt WHERE plt.key = 'week_intro_weeks');
  b_bucket   BOOLEAN := (SELECT plt.is_blocking FROM pro_launch_targets plt WHERE plt.key = 'min_videos_per_bucket');
  b_caption  BOOLEAN := (SELECT plt.is_blocking FROM pro_launch_targets plt WHERE plt.key = 'captions_pct');
  b_clinical BOOLEAN := (SELECT plt.is_blocking FROM pro_launch_targets plt WHERE plt.key = 'clinical_review_pct');
  v_total    INT;
BEGIN
  SELECT count(*) INTO v_total
  FROM manual_videos mv
  WHERE mv.review_status = 'approved'
    AND (mv.mux_playback_id IS NOT NULL OR mv.html_url IS NOT NULL);

  RETURN QUERY
  WITH combos AS (
    SELECT a.audience, l.locale
    FROM (VALUES ('mom'), ('baby')) AS a(audience)
    CROSS JOIN (VALUES ('en'), ('es')) AS l(locale)
  ),
  covered AS (
    SELECT c.audience, c.locale,
           (SELECT count(DISTINCT wi.week_number)
              FROM manual_week_intro wi
             WHERE wi.audience = c.audience
               AND wi.locale   = c.locale
               AND wi.is_published
               AND wi.mux_playback_id IS NOT NULL)::INT AS weeks
    FROM combos c
  )
  SELECT
    'week_intro_coverage'::TEXT,
    (SELECT min(cv.weeks) FROM covered cv) >= t_weeks,
    (SELECT min(cv.weeks) FROM covered cv)::INT,
    t_weeks,
    b_weeks,
    'Weakest audience+locale: ' || COALESCE((
      SELECT cv.audience || '/' || cv.locale || ' has ' || cv.weeks || ' of ' || t_weeks || ' weeks'
        FROM covered cv ORDER BY cv.weeks ASC, cv.audience, cv.locale LIMIT 1
    ), 'none');

  RETURN QUERY
  WITH buckets AS (
    SELECT mv.audience, mv.category, count(*)::INT AS n
      FROM manual_videos mv
     WHERE mv.review_status = 'approved'
       AND (mv.mux_playback_id IS NOT NULL OR mv.html_url IS NOT NULL)
     GROUP BY mv.audience, mv.category
  )
  SELECT
    'videos_per_bucket'::TEXT,
    COALESCE((SELECT min(bk.n) FROM buckets bk), 0) >= t_bucket,
    COALESCE((SELECT min(bk.n) FROM buckets bk), 0)::INT,
    t_bucket,
    b_bucket,
    'Thinnest bucket: ' || COALESCE((
      SELECT bk.audience || '/' || bk.category || ' has ' || bk.n
        FROM buckets bk ORDER BY bk.n ASC, bk.audience, bk.category LIMIT 1
    ), 'no approved videos at all');

  RETURN QUERY
  SELECT
    'captions_both_locales'::TEXT,
    CASE WHEN v_total = 0 THEN FALSE
         ELSE (100 * count(*) FILTER (WHERE mv.has_captions_en AND mv.has_captions_es) / v_total) >= t_caption END,
    CASE WHEN v_total = 0 THEN 0
         ELSE (100 * count(*) FILTER (WHERE mv.has_captions_en AND mv.has_captions_es) / v_total)::INT END,
    t_caption,
    b_caption,
    count(*) FILTER (WHERE mv.has_captions_en AND mv.has_captions_es) || ' of ' || v_total ||
      ' playable videos captioned in both locales'
  FROM manual_videos mv
  WHERE mv.review_status = 'approved'
    AND (mv.mux_playback_id IS NOT NULL OR mv.html_url IS NOT NULL);

  RETURN QUERY
  SELECT
    'clinical_review'::TEXT,
    CASE WHEN v_total = 0 THEN FALSE
         ELSE (100 * count(*) FILTER (WHERE mv.clinical_advisor_reviewed) / v_total) >= t_clinical END,
    CASE WHEN v_total = 0 THEN 0
         ELSE (100 * count(*) FILTER (WHERE mv.clinical_advisor_reviewed) / v_total)::INT END,
    t_clinical,
    b_clinical,
    count(*) FILTER (WHERE mv.clinical_advisor_reviewed) || ' of ' || v_total ||
      ' playable videos have clinical advisor sign-off'
  FROM manual_videos mv
  WHERE mv.review_status = 'approved'
    AND (mv.mux_playback_id IS NOT NULL OR mv.html_url IS NOT NULL);
END;
$$;
REVOKE EXECUTE ON FUNCTION pro_launch_readiness() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION pro_launch_readiness() TO authenticated, service_role;

DO $$
DECLARE
  guard_fired BOOLEAN := FALSE;
  all_pass    BOOLEAN;
  err         TEXT;
  r           RECORD;
BEGIN
  RAISE NOTICE '--- villie pro launch readiness ---';
  FOR r IN SELECT * FROM pro_launch_readiness() LOOP
    RAISE NOTICE '% % (%/%) — %',
      rpad(r.check_name, 22),
      CASE WHEN r.ok THEN 'PASS' ELSE 'FAIL' END,
      r.actual, r.target, r.detail;
  END LOOP;

  SELECT bool_and(pr.ok) INTO all_pass FROM pro_launch_readiness() pr WHERE pr.blocking;

  BEGIN
    UPDATE feature_flags SET enabled = TRUE WHERE key = 'pro_video_gate';
  EXCEPTION WHEN OTHERS THEN
    guard_fired := TRUE;
    err := SQLERRM;
  END;

  IF all_pass THEN
    RAISE NOTICE 'Readiness passes — guard allowed the flip. Gate left OFF for a deliberate launch.';
  ELSIF guard_fired THEN
    RAISE NOTICE 'Guard verified — flip refused as expected: %', err;
  ELSE
    RAISE EXCEPTION 'GUARD FAILED: pro_video_gate was enabled while blocking checks were failing.';
  END IF;

  UPDATE feature_flags SET enabled = FALSE WHERE key = 'pro_video_gate';
END $$;
