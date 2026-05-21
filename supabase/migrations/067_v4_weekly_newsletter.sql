-- 067_v4_weekly_newsletter.sql
--
-- Villie weekly user newsletter (2026-05-21).
--
-- User-facing Sunday digest with: greeting + week, top Manual video for the
-- user's stage, saved-videos reminder, week milestone, weekend events,
-- stage perk, crisis footer. NOT to be confused with the
-- gear-moderation-daily-digest (that one only goes to the moderator).
--
-- Three pieces here:
-- (1) Add `newsletter` boolean to users.notif_prefs JSONB default + backfill
--     existing rows. Default FALSE (CAN-SPAM opt-in posture).
-- (2) newsletter_sends ledger — one row per (user_id, period_start_date).
--     Used for idempotency (don't re-send if the cron re-runs) + open/click
--     tracking when Resend webhooks are wired in a follow-up.
-- (3) list_newsletter_recipients RPC, service-role only — joins notif_prefs
--     opt-in, NOT-yet-sent-this-week, NOT-soft-deleted users so the edge
--     function can batch.

-- ── (1) notif_prefs default — add 'newsletter' ───────────────────
-- jsonb_set on existing rows that don't have the key yet. Idempotent.
UPDATE users
SET notif_prefs = jsonb_set(
  COALESCE(notif_prefs, '{}'::jsonb),
  '{newsletter}',
  'false'::jsonb,
  TRUE
)
WHERE (notif_prefs ? 'newsletter') = FALSE;

-- Update the column-level DEFAULT so new signups get the key. Note: this
-- supersedes the default set in migrations 032/033.
ALTER TABLE users ALTER COLUMN notif_prefs SET DEFAULT
  '{"events":true,"groups":true,"specialists":true,"milk_hub":true,"articles":true,"ai":true,"promotions":false,"newsletter":false,"quiet_hours":{"enabled":false,"start_hour":22,"end_hour":7,"tz":"America/New_York"}}'::jsonb;


-- ── (2) Newsletter send ledger ───────────────────────────────────
-- One row per user per ISO-week period_start. UNIQUE prevents double-sends
-- if the cron re-runs (the edge function checks NOT EXISTS before queueing
-- a Resend call). period_start is the Sunday-anchored start of the week
-- the digest covers (UTC).
CREATE TABLE IF NOT EXISTS newsletter_sends (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start    DATE        NOT NULL,
  -- Resend's message id for later open/click attribution. Nullable while
  -- the send is in flight.
  resend_id       TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Aggregate engagement signals — populated by future Resend webhook
  -- handler. Don't index until the webhook is wired (free-tier signal,
  -- nothing reads from it on the hot path).
  opened_at       TIMESTAMPTZ,
  first_click_at  TIMESTAMPTZ,
  click_count     INT         NOT NULL DEFAULT 0,
  -- Lightweight personalization snapshot — what we used to pick the
  -- video / milestone / events for this send. Useful for "why did I
  -- send this content?" debugging without a full content audit log.
  context         JSONB,
  UNIQUE (user_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_period
  ON newsletter_sends(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_user_recent
  ON newsletter_sends(user_id, sent_at DESC);

ALTER TABLE newsletter_sends ENABLE ROW LEVEL SECURITY;

-- Users can read their own send history (future "what did villie send me"
-- screen). No insert/update from the client — service-role only.
DROP POLICY IF EXISTS newsletter_sends_select_own ON newsletter_sends;
CREATE POLICY newsletter_sends_select_own
  ON newsletter_sends FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);


-- ── (3) list_newsletter_recipients RPC ───────────────────────────
-- Returns users eligible for the current week's digest:
--   * notif_prefs.newsletter = true
--   * email confirmed (auth.users.email_confirmed_at IS NOT NULL)
--   * not soft-deleted (users.deleted_at IS NULL)
--   * no newsletter_sends row for the requested period_start
--
-- Includes the personalization payload the edge function needs to build
-- the email so we don't round-trip per recipient.
CREATE OR REPLACE FUNCTION list_newsletter_recipients(p_period_start DATE)
RETURNS TABLE (
  user_id            UUID,
  email              TEXT,
  full_name          TEXT,
  preferred_language TEXT,
  pregnancy_stage    TEXT,
  current_week       INT,
  baby_first_name    TEXT,
  zip_code           TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    u.id AS user_id,
    au.email::TEXT AS email,
    u.full_name,
    COALESCE(u.preferred_language, 'en') AS preferred_language,
    u.pregnancy_stage,
    bp.current_week_number AS current_week,
    bp.baby_name AS baby_first_name,
    u.zip_code
  FROM users u
  JOIN auth.users au
    ON au.id = u.id
   AND au.email_confirmed_at IS NOT NULL
  LEFT JOIN baby_profiles_with_week bp ON bp.user_id = u.id
  WHERE u.deleted_at IS NULL
    AND COALESCE(u.notif_prefs->>'newsletter', 'false')::boolean = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM newsletter_sends ns
      WHERE ns.user_id = u.id AND ns.period_start = p_period_start
    );
$$;
REVOKE EXECUTE ON FUNCTION list_newsletter_recipients(DATE) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION list_newsletter_recipients(DATE) TO service_role;


-- ── (4) Per-user content picker RPC ──────────────────────────────
-- Returns the per-user content snapshot for one recipient. Service-role only;
-- the edge function calls this once per user and assembles the email.
--   * top_manual_video — best stage-matched approved video, prefer unwatched
--   * saved_count + saved_top_3 — for the "still on your list" reminder
--   * weekend_event_count, weekend_event_top - top events near user's ZIP
--     in the next 7 days (placeholder: just count, real geo join lives in
--     events fn; future migration ties in PostGIS query)
-- Keeping this RPC lean: returns aggregated JSON so the edge function gets
-- everything it needs without a fan-out.
CREATE OR REPLACE FUNCTION get_newsletter_content_for_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_locale TEXT;
  v_week   INT;
  v_stage  TEXT;
  v_top_video JSONB;
  v_saved JSONB;
  v_saved_count INT;
BEGIN
  SELECT COALESCE(u.preferred_language, 'en'),
         COALESCE(bp.current_week_number, 0),
         u.pregnancy_stage
    INTO v_locale, v_week, v_stage
  FROM users u
  LEFT JOIN baby_profiles_with_week bp ON bp.user_id = u.id
  WHERE u.id = p_user_id;

  -- Top Manual video for the user's current week (or the closest match
  -- when nothing is tagged for exactly this week). Unwatched preferred.
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
      -- prefer exactly-this-week tagged videos, then nearest-tagged,
      -- then any high-priority untagged.
      CASE WHEN mv.week_relevance = v_week THEN 0
           WHEN mv.week_relevance IS NULL THEN 9999
           ELSE ABS(mv.week_relevance - v_week)
      END,
      (vp.completed_at IS NOT NULL),  -- false (unwatched) first
      mv.sort_order ASC,
      mv.created_at ASC
    LIMIT 1
  ) t;

  -- Saved videos — count + up to 3 thumbnails for the reminder card.
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
    'locale',       v_locale,
    'current_week', v_week,
    'stage',        v_stage,
    'top_video',    v_top_video,
    'saved_count',  v_saved_count,
    'saved_top_3',  COALESCE(v_saved, '[]'::jsonb)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION get_newsletter_content_for_user(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION get_newsletter_content_for_user(UUID) TO service_role;


-- ── (5) record_newsletter_sent — idempotent insert ───────────────
-- Edge function calls this AFTER a successful Resend submission. The
-- UNIQUE(user_id, period_start) makes ON CONFLICT a no-op when the row
-- already exists (a re-run of the cron during the same week).
CREATE OR REPLACE FUNCTION record_newsletter_sent(
  p_user_id      UUID,
  p_period_start DATE,
  p_resend_id    TEXT,
  p_context      JSONB
) RETURNS VOID
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  INSERT INTO newsletter_sends (user_id, period_start, resend_id, context)
  VALUES (p_user_id, p_period_start, p_resend_id, p_context)
  ON CONFLICT (user_id, period_start) DO UPDATE
    SET resend_id = EXCLUDED.resend_id,
        context   = EXCLUDED.context;
$$;
REVOKE EXECUTE ON FUNCTION record_newsletter_sent(UUID, DATE, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION record_newsletter_sent(UUID, DATE, TEXT, JSONB) TO service_role;
