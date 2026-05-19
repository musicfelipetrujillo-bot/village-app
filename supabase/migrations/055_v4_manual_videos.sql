-- 055_v4_manual_videos.sql
-- Manual = short-video library (Mux-hosted, ≤2 min, EN+ES captions). Replaces
-- the article-based Manual sourced from maternal_insights / milestone_library —
-- those tables remain as long-form content for WeeklyJourney + MilestoneDetail
-- (the screens you tap through to from Home / the milestone timeline). The
-- Manual surface itself becomes a tile-grid → 2-col thumbnail browser, with
-- the player rendered in a new ManualVideoScreen.
--
-- Audience/category model mirrors the existing tile UX:
--   mom:  feel | heal | nourish | rest | tips
--   baby: feed | sleep | grow    | care | tips
-- The 10 (audience, category) pairs are enforced via a composite CHECK so
-- the seed/admin tooling can never insert into a bucket the UI doesn't render.
-- Care is a real bucket here (unlike the article-era stub) because video is
-- the right medium for "is this gas or colic?" symptom triage content.
--
-- 2-min hard cap is enforced at the DB (CHECK duration_seconds BETWEEN 1 AND 120)
-- so any future admin/CMS path can't quietly upload a 10-min lecture.
--
-- Mux carries the playback. We store `mux_playback_id` (signed-playback ready
-- when we wire signing later — for now public playback IDs are fine since
-- approved videos are explicitly public-read), plus poster/thumbnail URLs
-- as an optimization (avoids round-tripping Mux for grid rendering). Captions
-- live as VTT URLs (Mux auto-generates EN; ES is a follow-on pass).
--
-- i18n side-table mirrors maternal_insights_i18n (parent-approval-gated read).

CREATE TABLE manual_videos (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audience                    TEXT        NOT NULL CHECK (audience IN ('mom', 'baby')),
  category                    TEXT        NOT NULL,

  -- Title + short description shown on the thumbnail card. Description is
  -- intentionally short — the video is the content, not the blurb.
  title                       TEXT        NOT NULL CHECK (char_length(title)       BETWEEN 1 AND 120),
  description                 TEXT        NOT NULL CHECK (char_length(description) BETWEEN 1 AND 280),

  -- Hard 2-min cap per product decision (2026-05-01). Any longer-form video
  -- belongs on WeeklyJourney/MilestoneDetail, not Manual.
  duration_seconds            INT         NOT NULL CHECK (duration_seconds BETWEEN 1 AND 120),

  -- Mux playback. `mux_playback_id` is what expo-video plays via the HLS URL
  -- `https://stream.mux.com/{id}.m3u8`. Thumbnail/poster are pre-resolved
  -- so the grid doesn't need to know about Mux URL conventions.
  mux_playback_id             TEXT        NOT NULL CHECK (char_length(mux_playback_id) BETWEEN 1 AND 200),
  thumbnail_url               TEXT        NOT NULL,
  poster_url                  TEXT,

  -- Captions. Mux auto-generates EN VTT; ES is a manual pass. Booleans drive
  -- the captions toggle UI; the URLs are what expo-video loads.
  has_captions_en             BOOLEAN     NOT NULL DEFAULT FALSE,
  has_captions_es             BOOLEAN     NOT NULL DEFAULT FALSE,
  caption_url_en              TEXT,
  caption_url_es              TEXT,

  -- Optional discoverability fields. `week_relevance` lets us surface a
  -- "this week" curated row on Manual home (4 thumbnails) without a separate
  -- editorial table. `age_min/max_weeks` lets baby-side videos gate by age
  -- (e.g. "tummy time intro" only shows weeks 4-12).
  week_relevance              INT         CHECK (week_relevance IS NULL OR week_relevance BETWEEN 1 AND 52),
  age_min_weeks               INT         CHECK (age_min_weeks  IS NULL OR age_min_weeks  BETWEEN 0 AND 156),
  age_max_weeks               INT         CHECK (age_max_weeks  IS NULL OR age_max_weeks  BETWEEN 0 AND 156),

  -- Sort order within a (audience, category) bucket. Ties broken by created_at.
  sort_order                  INT         NOT NULL DEFAULT 100,

  -- Review pipeline mirrors maternal_insights — public-read gates on
  -- review_status='approved'. clinical_advisor_reviewed is the second
  -- required gate for any health-adjacent content (Care category especially).
  review_status               TEXT        NOT NULL DEFAULT 'pending'
                                          CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by                 UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at                 TIMESTAMPTZ,
  clinical_advisor_reviewed   BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Optional crisis footer flag — Care videos covering anything mom-mental-
  -- health adjacent should render the same crisis-resources card we show on
  -- WeeklyJourney + the daily-checkin crisis verdict path.
  requires_crisis_footer      BOOLEAN     NOT NULL DEFAULT FALSE,

  view_count                  INT         NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite (audience, category) CHECK — the only valid pairs are the 10
  -- the UI tiles render. New tiles → migration to extend this list.
  CONSTRAINT manual_videos_audience_category_valid CHECK (
    (audience = 'mom'  AND category IN ('feel', 'heal', 'nourish', 'rest', 'tips')) OR
    (audience = 'baby' AND category IN ('feed', 'sleep', 'grow',    'care', 'tips'))
  ),

  -- If captions are flagged present, the URL must be set — and vice versa.
  CONSTRAINT manual_videos_caption_en_consistent CHECK (
    (has_captions_en = FALSE AND caption_url_en IS NULL) OR
    (has_captions_en = TRUE  AND caption_url_en IS NOT NULL)
  ),
  CONSTRAINT manual_videos_caption_es_consistent CHECK (
    (has_captions_es = FALSE AND caption_url_es IS NULL) OR
    (has_captions_es = TRUE  AND caption_url_es IS NOT NULL)
  ),

  -- Age range sanity (only meaningful when both set).
  CONSTRAINT manual_videos_age_range_valid CHECK (
    age_min_weeks IS NULL OR age_max_weeks IS NULL OR age_min_weeks <= age_max_weeks
  )
);

CREATE INDEX idx_manual_videos_audience_category
  ON manual_videos (audience, category, sort_order, created_at)
  WHERE review_status = 'approved';

CREATE INDEX idx_manual_videos_week_relevance
  ON manual_videos (week_relevance)
  WHERE review_status = 'approved' AND week_relevance IS NOT NULL;

ALTER TABLE manual_videos ENABLE ROW LEVEL SECURITY;

-- Public read on approved videos only. Pending/rejected stay invisible to
-- mobile so the editorial pipeline can stage content without leakage.
CREATE POLICY manual_videos_select_approved
  ON manual_videos FOR SELECT
  USING (review_status = 'approved');

-- Reviewers (clinical) need to see pending rows in the admin tools — handled
-- via a separate reviewer-role policy when the admin UI lands. Service-role
-- bypasses RLS for ingestion + cron.

-- ---------------------------------------------------------------------------
-- i18n side-table — ES title/description. Mirrors maternal_insights_i18n.
-- Captions are tracked on the parent row (URL fields) since they're per-asset
-- on Mux's side. This table is just the card-level copy.
-- ---------------------------------------------------------------------------

CREATE TABLE manual_videos_i18n (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id    UUID        NOT NULL REFERENCES manual_videos(id) ON DELETE CASCADE,
  locale      TEXT        NOT NULL CHECK (locale IN ('es')),
  title       TEXT        NOT NULL CHECK (char_length(title)       BETWEEN 1 AND 120),
  description TEXT        NOT NULL CHECK (char_length(description) BETWEEN 1 AND 280),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, locale)
);
CREATE INDEX idx_manual_videos_i18n_lookup ON manual_videos_i18n(video_id, locale);

ALTER TABLE manual_videos_i18n ENABLE ROW LEVEL SECURITY;

CREATE POLICY manual_videos_i18n_select_when_parent_approved
  ON manual_videos_i18n FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM manual_videos mv
      WHERE mv.id = video_id AND mv.review_status = 'approved'
    )
  );

-- ---------------------------------------------------------------------------
-- Per-user watch progress. Used to render "Watched" overlays on the grid +
-- to resume mid-video on the player. PK on (user_id, video_id) so we don't
-- need a separate uniqueness constraint.
-- ---------------------------------------------------------------------------

CREATE TABLE manual_video_progress (
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id         UUID        NOT NULL REFERENCES manual_videos(id) ON DELETE CASCADE,
  watched_seconds  INT         NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  -- completed_at is set the first time the user crosses 90% of duration_seconds.
  -- Sticky once set — replaying doesn't unset it.
  completed_at     TIMESTAMPTZ,
  last_watched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, video_id)
);
CREATE INDEX idx_manual_video_progress_user ON manual_video_progress(user_id, last_watched_at DESC);

ALTER TABLE manual_video_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY manual_video_progress_select_own
  ON manual_video_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY manual_video_progress_insert_own
  ON manual_video_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY manual_video_progress_update_own
  ON manual_video_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- list_manual_videos — primary list call from ManualCategoryScreen.
-- Returns the per-user-localized card payload for one (audience, category)
-- bucket. ES users get translated title/description when present, else
-- fall back to EN. is_watched comes from manual_video_progress.completed_at.
CREATE OR REPLACE FUNCTION list_manual_videos(
  p_audience TEXT,
  p_category TEXT,
  p_locale   TEXT DEFAULT 'en'
) RETURNS TABLE (
  id                  UUID,
  title               TEXT,
  description         TEXT,
  duration_seconds    INT,
  mux_playback_id     TEXT,
  thumbnail_url       TEXT,
  poster_url          TEXT,
  has_captions_en     BOOLEAN,
  has_captions_es     BOOLEAN,
  week_relevance      INT,
  age_min_weeks       INT,
  age_max_weeks       INT,
  sort_order          INT,
  is_watched          BOOLEAN,
  watched_seconds     INT
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
    mv.thumbnail_url,
    mv.poster_url,
    mv.has_captions_en,
    mv.has_captions_es,
    mv.week_relevance,
    mv.age_min_weeks,
    mv.age_max_weeks,
    mv.sort_order,
    (mvp.completed_at IS NOT NULL)        AS is_watched,
    COALESCE(mvp.watched_seconds, 0)      AS watched_seconds
  FROM manual_videos mv
  LEFT JOIN manual_videos_i18n i18n
    ON i18n.video_id = mv.id AND i18n.locale = 'es'
  LEFT JOIN manual_video_progress mvp
    ON mvp.video_id = mv.id AND mvp.user_id = auth.uid()
  WHERE mv.review_status = 'approved'
    AND mv.audience = p_audience
    AND mv.category = p_category
  ORDER BY mv.sort_order ASC, mv.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION list_manual_videos(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION list_manual_videos(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- list_this_week_manual — curated 4-thumbnail row for ManualHomeScreen.
-- Picks up to 4 approved videos with `week_relevance = p_week`, sort_order
-- ascending. If fewer than 4 are tagged for the current week, fills with
-- highest-priority videos across all categories so the row never collapses.
CREATE OR REPLACE FUNCTION list_this_week_manual(
  p_week   INT,
  p_locale TEXT DEFAULT 'en'
) RETURNS TABLE (
  id                  UUID,
  audience            TEXT,
  category            TEXT,
  title               TEXT,
  duration_seconds    INT,
  thumbnail_url       TEXT,
  is_watched          BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  WITH curated AS (
    SELECT mv.id, 0 AS rank_bucket, mv.sort_order, mv.created_at
    FROM manual_videos mv
    WHERE mv.review_status = 'approved'
      AND mv.week_relevance = p_week
    LIMIT 4
  ),
  fillers AS (
    SELECT mv.id, 1 AS rank_bucket, mv.sort_order, mv.created_at
    FROM manual_videos mv
    WHERE mv.review_status = 'approved'
      AND mv.id NOT IN (SELECT id FROM curated)
    ORDER BY mv.sort_order ASC, mv.created_at ASC
    LIMIT 4
  ),
  picks AS (
    SELECT id, rank_bucket, sort_order, created_at FROM curated
    UNION ALL
    SELECT id, rank_bucket, sort_order, created_at FROM fillers
    ORDER BY rank_bucket ASC, sort_order ASC, created_at ASC
    LIMIT 4
  )
  SELECT
    mv.id,
    mv.audience,
    mv.category,
    COALESCE(CASE WHEN p_locale = 'es' THEN i18n.title END, mv.title) AS title,
    mv.duration_seconds,
    mv.thumbnail_url,
    (mvp.completed_at IS NOT NULL) AS is_watched
  FROM picks p
  JOIN manual_videos mv ON mv.id = p.id
  LEFT JOIN manual_videos_i18n i18n
    ON i18n.video_id = mv.id AND i18n.locale = 'es'
  LEFT JOIN manual_video_progress mvp
    ON mvp.video_id = mv.id AND mvp.user_id = auth.uid()
  ORDER BY p.rank_bucket ASC, p.sort_order ASC, p.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION list_this_week_manual(INT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION list_this_week_manual(INT, TEXT) TO authenticated, service_role;

-- mark_video_watched — upserts the user's progress row. completed_at is set
-- the first time we cross the 90% threshold and never unset (replays don't
-- "uncomplete" a video). watched_seconds tracks the max watched position so
-- the player can resume; we never decrement it.
CREATE OR REPLACE FUNCTION mark_video_watched(
  p_video_id UUID,
  p_seconds  INT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_duration   INT;
  v_threshold  INT;
  v_completed  TIMESTAMPTZ;
BEGIN
  IF p_seconds IS NULL OR p_seconds < 0 THEN
    RAISE EXCEPTION 'p_seconds must be >= 0';
  END IF;

  SELECT duration_seconds INTO v_duration
  FROM manual_videos
  WHERE id = p_video_id AND review_status = 'approved';

  IF v_duration IS NULL THEN
    -- Either the video doesn't exist or isn't approved. Don't write progress
    -- against rejected/pending content.
    RETURN;
  END IF;

  -- 90% threshold (e.g. 108s on a 120s video) marks completion.
  v_threshold := GREATEST(1, (v_duration * 9) / 10);
  IF p_seconds >= v_threshold THEN
    v_completed := NOW();
  ELSE
    v_completed := NULL;
  END IF;

  INSERT INTO manual_video_progress (user_id, video_id, watched_seconds, completed_at, last_watched_at)
  VALUES (auth.uid(), p_video_id, p_seconds, v_completed, NOW())
  ON CONFLICT (user_id, video_id) DO UPDATE
    SET watched_seconds = GREATEST(manual_video_progress.watched_seconds, EXCLUDED.watched_seconds),
        completed_at    = COALESCE(manual_video_progress.completed_at, EXCLUDED.completed_at),
        last_watched_at = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION mark_video_watched(UUID, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION mark_video_watched(UUID, INT) TO authenticated, service_role;
