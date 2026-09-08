-- 132 — villie pro launch gate: make the locale scope a decision, not a constant.
--
-- WHY
-- `pro_launch_readiness()` (migration 114) hardcoded the claim that we ship
-- BOTH locales: `week_intro_coverage` cross-joined {mom,baby} × {en,es} and
-- scored the WEAKEST combination, and `captions_both_locales` required
-- has_captions_en AND has_captions_es on every playable video.
--
-- That was correct while the plan was a bilingual launch. Felipe's call
-- (2026-08-17) is to record ENGLISH FIRST — and under the old function an
-- English-only library can never pass, no matter how much gets recorded:
-- mom/es and baby/es stay at 0 weeks, so min() stays 0 and the guard trigger
-- refuses the flip forever. The only escape was
-- `SET LOCAL app.pro_launch_override='on'`, which turns the guard off
-- wholesale — losing the checks that ARE still meaningful.
--
-- So the locale set becomes data. `pro_launch_targets.locales` says which
-- locales a check is allowed to claim:
--   · week_intro_weeks → {en}      — English-first. Add 'es' when Spanish
--                                     week-intros are actually recorded.
--   · captions_pct     → {en,es}   — UNCHANGED, on purpose. `manual_videos`
--     has no locale column: it is one language-neutral asset with per-locale
--     caption tracks (has_captions_en / has_captions_es). Serving Spanish
--     there is a TRANSLATION job, not a reshoot, so there is no reason to
--     stop claiming it. Relax it only with a deliberate:
--        UPDATE pro_launch_targets SET locales = ARRAY['en'] WHERE key = 'captions_pct';
--
-- WHAT THIS DOES NOT DO
-- It does not lower any target. week_intro_weeks stays at 52 — dropping to a
-- 12-week soft launch remains a one-line product decision (see
-- docs/PRO_VIDEO_LAUNCH_RUNBOOK.md), not something a migration should do
-- quietly. Narrowing the locale scope is a change of CLAIM; lowering a target
-- is a change of AMBITION. Only the first one is required to record English.
--
-- KNOWN GAP, deliberately not fixed here
-- `manual_week_intro` has NO caption columns at all, so the 52-week videos —
-- the paywall's headline benefit — cannot carry captions in this schema, and
-- `captions_pct` only ever measured `manual_videos`. (Despite its name,
-- `mark_week_intro_captioned()` writes to `manual_videos`.) Closing that needs
-- new columns + a check that reads them; it is a bigger change than a locale
-- switch and it should not ride along on this one.

-- 1. The locale scope column. Default keeps the pre-existing bilingual claim,
--    so any check row added later is strict until someone narrows it.
ALTER TABLE pro_launch_targets
  ADD COLUMN IF NOT EXISTS locales TEXT[] NOT NULL DEFAULT ARRAY['en', 'es'];

-- Guard against an empty array: a check claiming no locales would silently
-- pass, which is the opposite of what this table is for.
ALTER TABLE pro_launch_targets
  DROP CONSTRAINT IF EXISTS pro_launch_targets_locales_nonempty;
ALTER TABLE pro_launch_targets
  ADD CONSTRAINT pro_launch_targets_locales_nonempty
  CHECK (array_length(locales, 1) >= 1
         AND locales <@ ARRAY['en', 'es']);

COMMENT ON COLUMN pro_launch_targets.locales IS
  'Which locales this check is allowed to claim. week_intro_weeks={en} during '
  'the English-first launch; add es when Spanish week-intros exist.';

-- 2. English-first scope for week-intro coverage.
UPDATE pro_launch_targets SET locales = ARRAY['en'] WHERE key = 'week_intro_weeks';

-- 3. Readiness function. NOTE: CREATE OR REPLACE on a plpgsql function is a
--    WHOLE-BODY replace — the entire body below is carried forward from
--    migration 114 with only the two locale-aware changes. The return
--    signature is unchanged because the feature_flags guard trigger depends
--    on it.
CREATE OR REPLACE FUNCTION public.pro_launch_readiness()
 RETURNS TABLE(check_name text, ok boolean, actual integer, target integer, blocking boolean, detail text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  t_weeks    INT := (SELECT plt.target      FROM pro_launch_targets plt WHERE plt.key = 'week_intro_weeks');
  t_bucket   INT := (SELECT plt.target      FROM pro_launch_targets plt WHERE plt.key = 'min_videos_per_bucket');
  t_caption  INT := (SELECT plt.target      FROM pro_launch_targets plt WHERE plt.key = 'captions_pct');
  t_clinical INT := (SELECT plt.target      FROM pro_launch_targets plt WHERE plt.key = 'clinical_review_pct');
  b_weeks    BOOLEAN := (SELECT plt.is_blocking FROM pro_launch_targets plt WHERE plt.key = 'week_intro_weeks');
  b_bucket   BOOLEAN := (SELECT plt.is_blocking FROM pro_launch_targets plt WHERE plt.key = 'min_videos_per_bucket');
  b_caption  BOOLEAN := (SELECT plt.is_blocking FROM pro_launch_targets plt WHERE plt.key = 'captions_pct');
  b_clinical BOOLEAN := (SELECT plt.is_blocking FROM pro_launch_targets plt WHERE plt.key = 'clinical_review_pct');
  -- NEW: the locale claim per check.
  l_weeks    TEXT[] := (SELECT plt.locales FROM pro_launch_targets plt WHERE plt.key = 'week_intro_weeks');
  l_caption  TEXT[] := (SELECT plt.locales FROM pro_launch_targets plt WHERE plt.key = 'captions_pct');
  need_en    BOOLEAN;
  need_es    BOOLEAN;
  v_total    INT;
BEGIN
  need_en := 'en' = ANY(COALESCE(l_caption, ARRAY['en', 'es']));
  need_es := 'es' = ANY(COALESCE(l_caption, ARRAY['en', 'es']));

  SELECT count(*) INTO v_total
  FROM manual_videos mv
  WHERE mv.review_status = 'approved'
    AND (mv.mux_playback_id IS NOT NULL OR mv.html_url IS NOT NULL);

  RETURN QUERY
  WITH combos AS (
    -- CHANGED: locales come from pro_launch_targets, not a hardcoded VALUES
    -- list, so an English-first library is measurable instead of impossible.
    SELECT a.audience, l.locale
    FROM (VALUES ('mom'), ('baby')) AS a(audience)
    CROSS JOIN unnest(COALESCE(l_weeks, ARRAY['en', 'es'])) AS l(locale)
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
    'Claiming ' || array_to_string(COALESCE(l_weeks, ARRAY['en','es']), '+')
      || '. Weakest audience+locale: ' || COALESCE((
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
    -- CHANGED: only require the caption locales we actually claim.
    'captions_both_locales'::TEXT,
    CASE WHEN v_total = 0 THEN FALSE
         ELSE (100 * count(*) FILTER (
                WHERE (NOT need_en OR mv.has_captions_en)
                  AND (NOT need_es OR mv.has_captions_es)
              ) / v_total) >= t_caption END,
    CASE WHEN v_total = 0 THEN 0
         ELSE (100 * count(*) FILTER (
                WHERE (NOT need_en OR mv.has_captions_en)
                  AND (NOT need_es OR mv.has_captions_es)
              ) / v_total)::INT END,
    t_caption,
    b_caption,
    count(*) FILTER (
      WHERE (NOT need_en OR mv.has_captions_en)
        AND (NOT need_es OR mv.has_captions_es)
    ) || ' of ' || v_total || ' playable videos captioned in '
      || array_to_string(COALESCE(l_caption, ARRAY['en','es']), '+')
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
$function$;

-- 4. Re-assert reachability. CREATE OR REPLACE preserves the existing ACL, but
--    state it explicitly: this function reads the whole launch posture and is
--    ops-only. Revoking from PUBLIC alone is a no-op when Supabase has issued
--    explicit per-role grants (see migration 054), so revoke from both.
REVOKE ALL ON FUNCTION public.pro_launch_readiness() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pro_launch_readiness() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pro_launch_readiness() TO service_role;

-- 5. Self-test — mirrors migration 115: a later refactor that breaks the
--    locale scoping or re-opens the gate fails the migration chain instead of
--    silently shipping.
DO $$
DECLARE
  v_detail   TEXT;
  v_actual   INT;
  v_refused  BOOLEAN := FALSE;
BEGIN
  -- (a) week_intro_coverage must now measure ENGLISH ONLY. With zero rows in
  --     manual_week_intro the count is 0 either way, so assert on the detail
  --     string, which names the claim.
  SELECT r.detail, r.actual INTO v_detail, v_actual
    FROM pro_launch_readiness() r WHERE r.check_name = 'week_intro_coverage';
  IF v_detail NOT LIKE 'Claiming en.%' THEN
    RAISE EXCEPTION 'locale scope not applied — week_intro_coverage says: %', v_detail;
  END IF;
  IF v_detail LIKE '%/es has%' THEN
    RAISE EXCEPTION 'week_intro_coverage still measuring es while claiming en only: %', v_detail;
  END IF;

  -- (b) Spanish CAPTIONS are still claimed — narrowing week-intros must not
  --     have quietly dropped the subtitle promise.
  SELECT r.detail INTO v_detail
    FROM pro_launch_readiness() r WHERE r.check_name = 'captions_both_locales';
  IF v_detail NOT LIKE '%en+es%' THEN
    RAISE EXCEPTION 'caption locale claim changed unexpectedly: %', v_detail;
  END IF;

  -- (c) The guard must still refuse the flip: narrowing a claim is not the
  --     same as being ready, and nothing here should have opened the door.
  BEGIN
    UPDATE feature_flags SET enabled = TRUE WHERE key = 'pro_video_gate';
  EXCEPTION WHEN OTHERS THEN
    v_refused := TRUE;
  END;
  IF NOT v_refused THEN
    RAISE EXCEPTION 'pro_video_gate guard did NOT refuse a premature flip';
  END IF;

  RAISE NOTICE '132 self-test passed: english-first scope active, es captions still claimed, guard still closed';
END $$;
