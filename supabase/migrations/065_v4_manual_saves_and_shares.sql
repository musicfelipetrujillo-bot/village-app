-- 065_v4_manual_saves_and_shares.sql
--
-- Manual: Saved/Favorites + Share to social (2026-05-21).
--
-- User-facing motivations:
-- (1) Saves — let users bookmark short videos they want to come back to.
--     Mirrors saved_gear / saved_donor / favorites_specialist patterns;
--     unique on (user_id, video_id) so toggle reuses one row.
-- (2) Shares — record which videos get shared and to which channel so we
--     can answer "what content actually travels?". The channel enum is
--     a fixed allowlist (no free-form strings) and gets indexed.
--
-- Both tables: own-row RLS, no service-role writes from this migration
-- (clients only ever toggle their own saves/shares — analytics joins live
-- in admin tooling).

-- ── Saves ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manual_video_saves (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id  UUID        NOT NULL REFERENCES manual_videos(id) ON DELETE CASCADE,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_manual_saves_user_recent
  ON manual_video_saves(user_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_saves_video
  ON manual_video_saves(video_id);
ALTER TABLE manual_video_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manual_saves_select_own ON manual_video_saves;
CREATE POLICY manual_saves_select_own
  ON manual_video_saves FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS manual_saves_insert_own ON manual_video_saves;
CREATE POLICY manual_saves_insert_own
  ON manual_video_saves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS manual_saves_delete_own ON manual_video_saves;
CREATE POLICY manual_saves_delete_own
  ON manual_video_saves FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ── Shares (analytics + attribution) ────────────────────────────
-- channel enum is fixed to keep the join sane. 'ios_share_sheet' covers the
-- "tap Share, let iOS pick the app" path; the named channels are populated
-- if/when we eventually wire deep-link share intents (currently the share
-- sheet doesn't tell us which app the user picked, so 'ios_share_sheet' is
-- the most common value at MVP).
CREATE TABLE IF NOT EXISTS manual_video_shares (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  video_id   UUID        NOT NULL REFERENCES manual_videos(id) ON DELETE CASCADE,
  channel    TEXT        NOT NULL CHECK (channel IN (
    'ios_share_sheet','android_share_sheet','copy_link',
    'instagram','twitter','facebook','sms','email','whatsapp','other'
  )),
  shared_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_manual_shares_video_recent
  ON manual_video_shares(video_id, shared_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_shares_user_recent
  ON manual_video_shares(user_id, shared_at DESC);
ALTER TABLE manual_video_shares ENABLE ROW LEVEL SECURITY;

-- Users see their own share log only. Aggregate "which content works best"
-- queries run service-role from admin tooling.
DROP POLICY IF EXISTS manual_shares_select_own ON manual_video_shares;
CREATE POLICY manual_shares_select_own
  ON manual_video_shares FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS manual_shares_insert_own ON manual_video_shares;
CREATE POLICY manual_shares_insert_own
  ON manual_video_shares FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ── toggle_manual_save: idempotent save/unsave ──────────────────
-- Returns true when the video is saved after the call, false when unsaved.
-- Mobile reads the return value to flip the heart state without a refetch.
CREATE OR REPLACE FUNCTION toggle_manual_save(p_video_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_exists BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM manual_video_saves
    WHERE user_id = v_uid AND video_id = p_video_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM manual_video_saves
    WHERE user_id = v_uid AND video_id = p_video_id;
    RETURN FALSE;
  ELSE
    INSERT INTO manual_video_saves (user_id, video_id)
    VALUES (v_uid, p_video_id)
    ON CONFLICT (user_id, video_id) DO NOTHING;
    RETURN TRUE;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION toggle_manual_save(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION toggle_manual_save(UUID) TO authenticated, service_role;


-- ── log_manual_share: insert one row per outbound share ─────────
-- Returns nothing; intentional fire-and-forget on the client. The CHECK on
-- channel rejects unknown channels before they pollute the analytics.
CREATE OR REPLACE FUNCTION log_manual_share(
  p_video_id UUID,
  p_channel  TEXT
) RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  INSERT INTO manual_video_shares (user_id, video_id, channel)
  VALUES (v_uid, p_video_id, p_channel);
END;
$$;
REVOKE EXECUTE ON FUNCTION log_manual_share(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION log_manual_share(UUID, TEXT) TO authenticated, service_role;


-- ── list_manual_videos (extended) ───────────────────────────────
-- Adds is_saved to the existing row shape from migration 055. Signature
-- changes so we DROP first, then CREATE. The body is otherwise identical
-- to the migration 055/057 version (i18n + watched join) with one extra
-- LEFT JOIN to manual_video_saves.
DROP FUNCTION IF EXISTS list_manual_videos(TEXT, TEXT, TEXT);
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


-- ── list_my_saved_manual: list of one user's saves, newest first ─
-- Same row shape as list_manual_videos so the SavedManualScreen reuses the
-- existing video-card components.
CREATE OR REPLACE FUNCTION list_my_saved_manual(
  p_locale TEXT DEFAULT 'en'
) RETURNS TABLE (
  id                  UUID,
  audience            TEXT,
  category            TEXT,
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
  is_watched          BOOLEAN,
  watched_seconds     INT,
  saved_at            TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT
    mv.id,
    mv.audience,
    mv.category,
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
    (vp.completed_at IS NOT NULL) AS is_watched,
    COALESCE(vp.watched_seconds, 0) AS watched_seconds,
    sv.saved_at
  FROM manual_video_saves sv
  JOIN manual_videos mv
    ON mv.id = sv.video_id AND mv.review_status = 'approved'
  LEFT JOIN manual_videos_i18n i18n
         ON i18n.video_id = mv.id AND i18n.locale = p_locale
  LEFT JOIN manual_video_progress vp
         ON vp.video_id = mv.id AND vp.user_id = auth.uid()
  WHERE sv.user_id = auth.uid()
  ORDER BY sv.saved_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION list_my_saved_manual(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION list_my_saved_manual(TEXT) TO authenticated, service_role;
