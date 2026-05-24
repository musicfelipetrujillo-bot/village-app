-- 070_v4_newsletter_richer_content.sql
--
-- Newsletter v2 content expansion (2026-05-24).
--
-- Adds two more blocks to get_newsletter_content_for_user so the Sunday
-- digest has body beyond a single "today's tip" video:
--   * more_videos     — up to 3 additional stage-matched unwatched videos
--                       (excluding the top_video already picked). Mom's
--                       "tips this week" pack.
--   * milestone_article — the user's current-week milestone_library row
--                       with title + hero_emoji + the ai_summary_cache
--                       text. Reads as a short editorial article.
--
-- Signature swaps to JSONB return shape (was the same before — extra
-- keys added). CREATE OR REPLACE works because the return type doesn't
-- change.

CREATE OR REPLACE FUNCTION get_newsletter_content_for_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_locale        TEXT;
  v_week          INT;
  v_stage         TEXT;
  v_top_video     JSONB;
  v_more_videos   JSONB;
  v_milestone     JSONB;
  v_saved         JSONB;
  v_saved_count   INT;
BEGIN
  SELECT COALESCE(u.preferred_language, 'en'),
         COALESCE(bp.current_week_number, 0),
         u.pregnancy_stage
    INTO v_locale, v_week, v_stage
  FROM users u
  LEFT JOIN baby_profiles_with_week bp ON bp.user_id = u.id
  WHERE u.id = p_user_id;

  -- ── Top video — closest stage match, prefer unwatched ──
  SELECT to_jsonb(t.*) INTO v_top_video FROM (
    SELECT mv.id, mv.audience, mv.category,
      COALESCE(CASE WHEN v_locale = 'es' THEN i18n.title       END, mv.title)       AS title,
      COALESCE(CASE WHEN v_locale = 'es' THEN i18n.description END, mv.description) AS description,
      mv.duration_seconds, mv.thumbnail_url
    FROM manual_videos mv
    LEFT JOIN manual_videos_i18n i18n ON i18n.video_id = mv.id AND i18n.locale = v_locale
    LEFT JOIN manual_video_progress vp ON vp.video_id = mv.id AND vp.user_id = p_user_id
    WHERE mv.review_status = 'approved'
    ORDER BY
      CASE WHEN mv.week_relevance = v_week THEN 0
           WHEN mv.week_relevance IS NULL THEN 9999
           ELSE ABS(mv.week_relevance - v_week)
      END,
      (vp.completed_at IS NOT NULL),  -- unwatched first
      mv.sort_order ASC,
      mv.created_at ASC
    LIMIT 1
  ) t;

  -- ── More videos for the week — same ranking as top_video but skip
  --     the one we just picked. Cap at 3, prefer unwatched, prefer
  --     spread across categories so the "pack" isn't all sleep or all
  --     feeding (ROW_NUMBER() partitioned by category, then sorted by
  --     relevance + take top 3). ──
  SELECT jsonb_agg(t.*) INTO v_more_videos FROM (
    SELECT * FROM (
      SELECT mv.id, mv.audience, mv.category,
        COALESCE(CASE WHEN v_locale = 'es' THEN i18n.title       END, mv.title)       AS title,
        mv.duration_seconds, mv.thumbnail_url,
        ROW_NUMBER() OVER (PARTITION BY mv.category ORDER BY
          CASE WHEN mv.week_relevance = v_week THEN 0
               WHEN mv.week_relevance IS NULL THEN 9999
               ELSE ABS(mv.week_relevance - v_week)
          END,
          (vp.completed_at IS NOT NULL),
          mv.sort_order ASC
        ) AS cat_rank,
        CASE WHEN mv.week_relevance = v_week THEN 0
             WHEN mv.week_relevance IS NULL THEN 9999
             ELSE ABS(mv.week_relevance - v_week)
        END AS dist
      FROM manual_videos mv
      LEFT JOIN manual_videos_i18n i18n ON i18n.video_id = mv.id AND i18n.locale = v_locale
      LEFT JOIN manual_video_progress vp ON vp.video_id = mv.id AND vp.user_id = p_user_id
      WHERE mv.review_status = 'approved'
        AND mv.id <> COALESCE((v_top_video->>'id')::UUID, '00000000-0000-0000-0000-000000000000'::UUID)
    ) ranked
    WHERE cat_rank = 1  -- one per category for the spread
    ORDER BY dist ASC, audience, category
    LIMIT 3
  ) t;

  -- ── This week's milestone — pulled from milestone_library. Returns
  --     the user's current-week row with the AI summary if cached, else
  --     falls back to the static description. Null when the user has no
  --     current_week (TTC / no baby profile / week > 52). ──
  IF v_week BETWEEN 1 AND 52 THEN
    SELECT to_jsonb(t.*) INTO v_milestone FROM (
      SELECT m.week_number, m.category, m.title, m.hero_emoji,
        COALESCE(m.ai_summary_cache, m.description) AS body
      FROM milestone_library m
      WHERE m.week_number = v_week
      ORDER BY m.id
      LIMIT 1
    ) t;
  END IF;

  -- ── Saved videos (unchanged from v1) ──
  SELECT COUNT(*) INTO v_saved_count
  FROM manual_video_saves WHERE user_id = p_user_id;

  SELECT jsonb_agg(t.*) INTO v_saved FROM (
    SELECT mv.id,
      COALESCE(CASE WHEN v_locale = 'es' THEN i18n.title END, mv.title) AS title,
      mv.thumbnail_url, mv.duration_seconds, sv.saved_at
    FROM manual_video_saves sv
    JOIN manual_videos mv ON mv.id = sv.video_id AND mv.review_status = 'approved'
    LEFT JOIN manual_videos_i18n i18n ON i18n.video_id = mv.id AND i18n.locale = v_locale
    WHERE sv.user_id = p_user_id
    ORDER BY sv.saved_at DESC
    LIMIT 3
  ) t;

  RETURN jsonb_build_object(
    'locale',           v_locale,
    'current_week',     v_week,
    'stage',            v_stage,
    'top_video',        v_top_video,
    'more_videos',      COALESCE(v_more_videos, '[]'::jsonb),
    'milestone_article', v_milestone,
    'saved_count',      v_saved_count,
    'saved_top_3',      COALESCE(v_saved, '[]'::jsonb)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION get_newsletter_content_for_user(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION get_newsletter_content_for_user(UUID) TO service_role;
