-- 088_v4_manual_videos_html_clips.sql
-- Manual videos: support self-hosted HTML clips (animated React/CSS pieces
-- exported from Claude Design) alongside the Mux path, open the `soothe`
-- bucket on the baby side, and seed the first 11 real clips.
--
-- WHY HTML and not Mux: the field-guide + tip clips are animated HTML/JS
-- (scene systems, requestAnimationFrame), not encoded video. The Manual
-- player is already a WebView, so it can load these directly. We store a
-- RELATIVE path (`/manual-videos/<slug>.html`); the mobile client prepends a
-- configurable origin (EXPO_PUBLIC_MANUAL_VIDEO_ORIGIN, default the village
-- website) so the same rows work in dev (localhost:8090) and prod.
--
-- DEPLOY NOTES:
--   1. The HTML bundle must be hosted at <origin>/manual-videos/ (the files
--      live in village-website/manual-videos/). Deploy the village website
--      publicly before real devices can play these; localhost works for the
--      simulator + Expo web.
--   2. The dev-seed placeholder rows from 056 are left untouched; remove them
--      separately if you want a clean grid.

-- ── 1. Schema: html_url column + relax mux NOT NULL ──────────────────────────
ALTER TABLE manual_videos ADD COLUMN IF NOT EXISTS html_url TEXT;

ALTER TABLE manual_videos ALTER COLUMN mux_playback_id DROP NOT NULL;

-- A row must carry exactly one playback source.
ALTER TABLE manual_videos DROP CONSTRAINT IF EXISTS manual_videos_playback_source;
ALTER TABLE manual_videos ADD CONSTRAINT manual_videos_playback_source CHECK (
  (mux_playback_id IS NOT NULL) OR (html_url IS NOT NULL)
);

-- ── 2. Open the baby `soothe` bucket (mirrors the app's Soothe chapter) ──────
-- The Manual home shows a baby Soothe chapter, but the original CHECK only
-- allowed baby feed/sleep/grow/care/tips. Add soothe (keep tips for back-compat).
ALTER TABLE manual_videos DROP CONSTRAINT IF EXISTS manual_videos_audience_category_valid;
ALTER TABLE manual_videos ADD CONSTRAINT manual_videos_audience_category_valid CHECK (
  (audience = 'mom'  AND category IN ('feel', 'heal', 'nourish', 'rest', 'tips')) OR
  (audience = 'baby' AND category IN ('feed', 'sleep', 'grow', 'care', 'tips', 'soothe'))
);

-- ── 3. Recreate list_manual_videos to return html_url ────────────────────────
-- (RETURNS TABLE shape changes, so DROP first.) Body mirrors migration 065 +
-- the new column. Grants re-applied per the 052/054 security posture.
DROP FUNCTION IF EXISTS list_manual_videos(TEXT, TEXT, TEXT);
CREATE FUNCTION list_manual_videos(
  p_audience TEXT,
  p_category TEXT,
  p_locale   TEXT DEFAULT 'en'
) RETURNS TABLE (
  id                  UUID,
  title               TEXT,
  description         TEXT,
  duration_seconds    INT,
  mux_playback_id     TEXT,
  html_url            TEXT,
  thumbnail_url       TEXT,
  poster_url          TEXT,
  has_captions_en     BOOLEAN,
  has_captions_es     BOOLEAN,
  week_relevance      INT,
  age_min_weeks       INT,
  age_max_weeks       INT,
  sort_order          INT,
  is_watched          BOOLEAN,
  watched_seconds     INT,
  is_saved            BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT
    mv.id,
    COALESCE(CASE WHEN p_locale = 'es' THEN i18n.title       END, mv.title)       AS title,
    COALESCE(CASE WHEN p_locale = 'es' THEN i18n.description END, mv.description) AS description,
    mv.duration_seconds,
    mv.mux_playback_id,
    mv.html_url,
    mv.thumbnail_url,
    mv.poster_url,
    mv.has_captions_en,
    mv.has_captions_es,
    mv.week_relevance,
    mv.age_min_weeks,
    mv.age_max_weeks,
    mv.sort_order,
    (vp.completed_at IS NOT NULL) AS is_watched,
    COALESCE(vp.watched_seconds, 0) AS watched_seconds,
    (sv.user_id IS NOT NULL)        AS is_saved
  FROM manual_videos mv
  LEFT JOIN manual_videos_i18n i18n
         ON i18n.video_id = mv.id AND i18n.locale = p_locale
  LEFT JOIN manual_video_progress vp
         ON vp.video_id = mv.id AND vp.user_id = auth.uid()
  LEFT JOIN manual_video_saves sv
         ON sv.video_id = mv.id AND sv.user_id = auth.uid()
  WHERE mv.audience = p_audience
    AND mv.category = p_category
    AND mv.review_status = 'approved'
  ORDER BY mv.sort_order ASC, mv.created_at ASC;
$$;
REVOKE EXECUTE ON FUNCTION list_manual_videos(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION list_manual_videos(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ── 4. Seed the 11 real clips ────────────────────────────────────────────────
-- thumbnail_url + html_url are RELATIVE; the client prepends the origin.
-- review_status approved so they surface; mux_playback_id NULL (HTML source).
INSERT INTO manual_videos
  (audience, category, title, description, duration_seconds,
   html_url, thumbnail_url, mux_playback_id,
   has_captions_en, week_relevance, sort_order, review_status, clinical_advisor_reviewed)
VALUES
  ('baby','soothe', 'The 5 S''s for Soothing',
   'Five evidence-based moves that calm a crying baby, in the order that works.', 62,
   '/manual-videos/ep01-5ss.html', '/manual-videos/posters/ep01-5ss.png', NULL,
   FALSE, 4, 10, 'approved', FALSE),

  ('mom','feel', 'Tears & Mood',
   'The baby blues, what is normal in the first weeks, and when low mood needs more support.', 75,
   '/manual-videos/ep02-tears-mood.html', '/manual-videos/posters/ep02-tears-mood.png', NULL,
   FALSE, 2, 10, 'approved', FALSE),

  ('baby','sleep', 'The Contact Nap',
   'Why your baby only sleeps on you, and how to work with the contact nap instead of fighting it.', 75,
   '/manual-videos/ep03-contact-nap.html', '/manual-videos/posters/ep03-contact-nap.png', NULL,
   FALSE, 3, 10, 'approved', FALSE),

  ('baby','feed', 'Enough Milk',
   'How to know your baby is getting enough, without the 2am spiral. The signals that actually matter.', 75,
   '/manual-videos/ep04-enough-milk.html', '/manual-videos/posters/ep04-enough-milk.png', NULL,
   FALSE, 2, 10, 'approved', FALSE),

  ('mom','feel', 'The 3 a.m. Spiral',
   'The 3 a.m. anxiety loop, named, so it loses a little of its grip.', 28,
   '/manual-videos/tip01-3am.html', '/manual-videos/posters/tip01-3am.png', NULL,
   FALSE, 2, 20, 'approved', FALSE),

  ('mom','rest', 'The 5-5-5 Rule',
   'Five days in bed, five on the bed, five near it. Permission to rest while you heal.', 28,
   '/manual-videos/tip02-555.html', '/manual-videos/posters/tip02-555.png', NULL,
   FALSE, 1, 20, 'approved', FALSE),

  ('baby','soothe', 'The Witching Hour',
   'Why evenings melt down around the same time, and what actually helps in the moment.', 28,
   '/manual-videos/tip03-witching.html', '/manual-videos/posters/tip03-witching.png', NULL,
   FALSE, 3, 20, 'approved', FALSE),

  ('baby','feed', 'A Good Latch',
   'What a deep, comfortable latch looks and feels like, and how to fix a shallow one.', 28,
   '/manual-videos/tip04-latch.html', '/manual-videos/posters/tip04-latch.png', NULL,
   FALSE, 1, 20, 'approved', FALSE),

  ('baby','feed', 'When to Pump',
   'When to start pumping and how it fits around feeds, without derailing your supply.', 28,
   '/manual-videos/tip05-pump.html', '/manual-videos/posters/tip05-pump.png', NULL,
   FALSE, 4, 21, 'approved', FALSE),

  ('mom','nourish', 'Drink When Baby Eats',
   'The simplest hydration habit there is: a full glass of water every time your baby eats.', 28,
   '/manual-videos/tip06-hydration.html', '/manual-videos/posters/tip06-hydration.png', NULL,
   FALSE, 1, 20, 'approved', FALSE),

  ('mom','feel', 'Your Crying Spells',
   'Your tears matter too. When a mom''s crying spells are normal, and when to reach out.', 28,
   '/manual-videos/tip07-crying.html', '/manual-videos/posters/tip07-crying.png', NULL,
   FALSE, 2, 21, 'approved', FALSE);
