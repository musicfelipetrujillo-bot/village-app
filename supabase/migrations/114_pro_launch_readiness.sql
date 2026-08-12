-- 114_pro_launch_readiness.sql
-- Make the villie pro launch a data drop, not an engineering scramble — and
-- make it IMPOSSIBLE to repeat the 2026-07-30 near-miss, where the paywall
-- advertised "every week's specialist video — all 52 weeks" and EN/ES captions
-- while `manual_week_intro` held 0 rows and 0 of 22 videos had any captions.
--
-- Three pieces:
--   1. pro_launch_readiness()  — one place that answers "can we sell this yet?"
--   2. a BEFORE UPDATE trigger — refuses to switch pro_video_gate ON while any
--      blocking check fails. The guard is the whole point: copy review is a
--      human habit, this is a machine that cannot forget.
--   3. mark_week_intro_captioned() — the ops path for flipping caption flags
--      once the tracks are actually attached to the Mux asset.
--
-- Thresholds live in the `pro_launch_targets` table so Felipe can adjust them
-- without a migration (e.g. soft-launch at 12 weeks instead of 52).

-- ── 1. Tunable targets ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pro_launch_targets (
  key         TEXT PRIMARY KEY,
  target      INT  NOT NULL,
  is_blocking BOOLEAN NOT NULL DEFAULT TRUE,
  note        TEXT
);
ALTER TABLE pro_launch_targets ENABLE ROW LEVEL SECURITY;
-- Service-role-only by design: ops tuning knob, nothing client-facing reads it.

INSERT INTO pro_launch_targets (key, target, is_blocking, note) VALUES
  ('week_intro_weeks',      52, TRUE,
   'Distinct published weeks with a playable week-intro video, per audience+locale. The paywall sells "all 52 weeks".'),
  ('min_videos_per_bucket',  2, TRUE,
   'Minimum approved how-to videos in every (audience, category) bucket, so no paying user opens an empty category.'),
  ('captions_pct',         100, TRUE,
   'Percent of playable videos with captions in BOTH locales. We advertise captions; a paid a11y claim must be true.'),
  ('clinical_review_pct',  100, TRUE,
   'Percent of playable videos with clinical_advisor_reviewed. Charging money for un-reviewed health video is a different liability posture than giving it away.')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Readiness report ──────────────────────────────────────────────────────
-- Returns one row per check. `ok` is what the guard reads; `detail` is what a
-- human reads. Deliberately cheap so it can run in a trigger.
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
  t_weeks    INT := (SELECT target FROM pro_launch_targets WHERE key = 'week_intro_weeks');
  t_bucket   INT := (SELECT target FROM pro_launch_targets WHERE key = 'min_videos_per_bucket');
  t_caption  INT := (SELECT target FROM pro_launch_targets WHERE key = 'captions_pct');
  t_clinical INT := (SELECT target FROM pro_launch_targets WHERE key = 'clinical_review_pct');
  b_weeks    BOOLEAN := (SELECT is_blocking FROM pro_launch_targets WHERE key = 'week_intro_weeks');
  b_bucket   BOOLEAN := (SELECT is_blocking FROM pro_launch_targets WHERE key = 'min_videos_per_bucket');
  b_caption  BOOLEAN := (SELECT is_blocking FROM pro_launch_targets WHERE key = 'captions_pct');
  b_clinical BOOLEAN := (SELECT is_blocking FROM pro_launch_targets WHERE key = 'clinical_review_pct');
  v_total    INT;
BEGIN
  -- A video is "playable" if it has a source: a Mux id or a self-hosted clip.
  SELECT count(*) INTO v_total
  FROM manual_videos
  WHERE review_status = 'approved'
    AND (mux_playback_id IS NOT NULL OR html_url IS NOT NULL);

  -- Check 1 — week-intro coverage. Worst-covered audience+locale combination
  -- wins, so a fully-loaded EN set can't mask an empty ES one.
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
    (SELECT min(weeks) FROM covered) >= t_weeks,
    (SELECT min(weeks) FROM covered)::INT,
    t_weeks,
    b_weeks,
    'Weakest audience+locale: ' || COALESCE((
      SELECT c.audience || '/' || c.locale || ' has ' || c.weeks || ' of ' || t_weeks || ' weeks'
        FROM covered c ORDER BY c.weeks ASC, c.audience, c.locale LIMIT 1
    ), 'none');

  -- Check 2 — no empty category behind the paywall.
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
    COALESCE((SELECT min(n) FROM buckets), 0) >= t_bucket,
    COALESCE((SELECT min(n) FROM buckets), 0)::INT,
    t_bucket,
    b_bucket,
    'Thinnest bucket: ' || COALESCE((
      SELECT b.audience || '/' || b.category || ' has ' || b.n
        FROM buckets b ORDER BY b.n ASC, b.audience, b.category LIMIT 1
    ), 'no approved videos at all');

  -- Check 3 — captions, in BOTH locales, on everything playable.
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

  -- Check 4 — clinical sign-off on everything we charge for.
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

-- ── 3. The guard ─────────────────────────────────────────────────────────────
-- Turning the gate ON is the moment users start paying for this content, so it
-- is the moment worth defending. OFF is always allowed — a kill-switch must
-- never be blocked. Set `pro_launch_override = 'on'` in the session to bypass
-- for a deliberate soft-launch:
--     SET LOCAL app.pro_launch_override = 'on';
CREATE OR REPLACE FUNCTION guard_pro_video_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  failures TEXT;
BEGIN
  IF NEW.key <> 'pro_video_gate' OR NEW.enabled IS NOT TRUE OR OLD.enabled IS TRUE THEN
    RETURN NEW;
  END IF;

  IF COALESCE(current_setting('app.pro_launch_override', TRUE), '') = 'on' THEN
    RAISE WARNING 'pro_video_gate enabled with readiness override — content claims on the paywall may be untrue';
    RETURN NEW;
  END IF;

  SELECT string_agg(r.check_name || ' (' || r.actual || '/' || r.target || ' — ' || r.detail || ')', '; ')
    INTO failures
    FROM pro_launch_readiness() r
   WHERE r.blocking AND NOT r.ok;

  IF failures IS NOT NULL THEN
    RAISE EXCEPTION
      'Refusing to enable pro_video_gate — the paywall would sell content that does not exist. Failing: %', failures
      USING HINT = 'Run: SELECT * FROM pro_launch_readiness(); Override deliberately with SET LOCAL app.pro_launch_override = ''on'';';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_pro_video_gate ON feature_flags;
CREATE TRIGGER trg_guard_pro_video_gate
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION guard_pro_video_gate();

-- ── 4. Caption bookkeeping ───────────────────────────────────────────────────
-- Captions live on the Mux asset (the player reads its text tracks); these
-- columns are our record of which assets actually have them. Flipping the flag
-- by hand in Studio is how they drift out of sync with reality, so this is the
-- one supported path — and it refuses to claim a caption without a URL.
CREATE OR REPLACE FUNCTION mark_week_intro_captioned(
  p_video_id UUID,
  p_locale   TEXT,
  p_url      TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_locale NOT IN ('en', 'es') THEN
    RAISE EXCEPTION 'locale must be en or es, got %', p_locale;
  END IF;
  IF p_url IS NULL OR length(trim(p_url)) = 0 THEN
    RAISE EXCEPTION 'caption url required — a caption flag without a track is exactly the bug this prevents';
  END IF;

  IF p_locale = 'en' THEN
    UPDATE manual_videos SET has_captions_en = TRUE, caption_url_en = p_url, updated_at = now()
     WHERE id = p_video_id;
  ELSE
    UPDATE manual_videos SET has_captions_es = TRUE, caption_url_es = p_url, updated_at = now()
     WHERE id = p_video_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no manual_videos row with id %', p_video_id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION mark_week_intro_captioned(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION mark_week_intro_captioned(UUID, TEXT, TEXT) TO service_role;
