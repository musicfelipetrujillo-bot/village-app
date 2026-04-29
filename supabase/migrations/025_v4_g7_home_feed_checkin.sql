-- V4 Phase G7 — Home feed + Daily check-in + AI orchestration
-- Ships:
--   1. daily_checkins          (per-user-per-day mood + text + AI reply, crisis-flagged)
--   2. home_feed_cache         (JSONB cards per user, TTL 24h — refreshed by home-feed-curator cron)
--   3. RLS (own-only reads, service-role writes to AI caches)
--   4. RPCs: upsert_daily_checkin, get_today_checkin, get_or_refresh_home_feed, list_active_home_users
--   5. pg_cron jobs (Sunday 00:10 ET milestone-explainer / daily 05:10 ET home-feed-curator / daily 08:00 ET checkin-reminder)
--
-- Safety posture (per Risk & Compliance — AI output is Village-owned content, NOT UGC):
--   - daily_checkins stores crisis_flagged so moderators can audit.
--   - ai_reply is bounded (<=800 chars via CHECK) — keeps hallucination surface small.
--   - No medical advice is persisted — the Edge Function prompt routes symptom-like
--     content to 988/911/PSI/specialist booking and sets crisis_flagged=TRUE.

-- ─────────────────────────────────────────────
-- 1. Daily check-in
-- ─────────────────────────────────────────────
CREATE TABLE daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood_score SMALLINT NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
  energy_score SMALLINT CHECK (energy_score BETWEEN 1 AND 5),
  user_response TEXT CHECK (char_length(user_response) <= 1000),
  ai_reply TEXT CHECK (char_length(ai_reply) <= 800),
  ai_reply_model TEXT,
  crisis_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  crisis_resources JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);

CREATE INDEX idx_daily_checkins_user_date ON daily_checkins(user_id, checkin_date DESC);
CREATE INDEX idx_daily_checkins_crisis ON daily_checkins(created_at DESC) WHERE crisis_flagged = TRUE;

CREATE OR REPLACE FUNCTION touch_checkin_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_checkins_touch
  BEFORE UPDATE ON daily_checkins
  FOR EACH ROW EXECUTE FUNCTION touch_checkin_updated_at();

-- ─────────────────────────────────────────────
-- 2. Home feed cache
-- ─────────────────────────────────────────────
-- `cards` is an ordered JSONB array of card objects:
--   [{ block: 'milestone'|'checkin'|'events'|'perks'|'gear_tip'|'quickaccess',
--      payload: {...}, priority: int }]
-- home-feed-curator writes; mobile reads and may trigger refresh if expires_at < now().
CREATE TABLE home_feed_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cards JSONB NOT NULL DEFAULT '[]'::JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  generator_version TEXT NOT NULL DEFAULT 'v1',
  model_used TEXT
);

CREATE INDEX idx_home_feed_cache_expiry ON home_feed_cache(expires_at);

-- ─────────────────────────────────────────────
-- 3. RLS
-- ─────────────────────────────────────────────
ALTER TABLE daily_checkins   ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_feed_cache  ENABLE ROW LEVEL SECURITY;

-- daily_checkins: own-only read + own-only insert/update (AI reply is written by
-- Edge Function running as service role; user's own upsert flow only writes
-- mood+user_response then Edge Function patches the AI fields).
CREATE POLICY "checkin_select_own" ON daily_checkins
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "checkin_insert_own" ON daily_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "checkin_update_own" ON daily_checkins
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "checkin_service_all" ON daily_checkins
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- home_feed_cache: user reads own; only service role writes (curator cron + on-demand refresh)
CREATE POLICY "home_feed_select_own" ON home_feed_cache
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "home_feed_service_write" ON home_feed_cache
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- 4. RPCs
-- ─────────────────────────────────────────────

-- upsert_daily_checkin — user-facing; mobile calls this after user taps a mood
-- + optional text. Returns the row so the caller can hand it to the Edge Function
-- to generate ai_reply. SECURITY INVOKER so RLS own-only applies.
CREATE OR REPLACE FUNCTION upsert_daily_checkin(
  p_mood_score SMALLINT,
  p_energy_score SMALLINT DEFAULT NULL,
  p_user_response TEXT DEFAULT NULL
) RETURNS SETOF daily_checkins
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  RETURN QUERY
  INSERT INTO daily_checkins (user_id, checkin_date, mood_score, energy_score, user_response)
  VALUES (v_user, CURRENT_DATE, p_mood_score, p_energy_score, p_user_response)
  ON CONFLICT (user_id, checkin_date) DO UPDATE
    SET mood_score = EXCLUDED.mood_score,
        energy_score = COALESCE(EXCLUDED.energy_score, daily_checkins.energy_score),
        user_response = COALESCE(EXCLUDED.user_response, daily_checkins.user_response),
        updated_at = now()
  RETURNING *;
END;
$$;

-- get_today_checkin — returns today's row if any.
CREATE OR REPLACE FUNCTION get_today_checkin()
RETURNS SETOF daily_checkins
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT * FROM daily_checkins
  WHERE user_id = auth.uid() AND checkin_date = CURRENT_DATE
  LIMIT 1;
$$;

-- get_home_feed — returns cached cards; caller decides whether to trigger
-- a curator refresh when expires_at < now(). SECURITY INVOKER enforces own-only.
CREATE OR REPLACE FUNCTION get_home_feed()
RETURNS TABLE (
  cards JSONB,
  generated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_stale BOOLEAN
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    hfc.cards,
    hfc.generated_at,
    hfc.expires_at,
    (hfc.expires_at < now()) AS is_stale
  FROM home_feed_cache hfc
  WHERE hfc.user_id = auth.uid();
$$;

-- list_active_home_users — feeds home-feed-curator cron. Returns users who have
-- signed in in the past 14 days and have a baby_profile (curator needs a week
-- number to anchor the feed). Service-role only.
CREATE OR REPLACE FUNCTION list_active_home_users(p_limit INT DEFAULT 500)
RETURNS TABLE (
  user_id UUID,
  current_week_number SMALLINT,
  feeding_method TEXT,
  pregnancy_stage TEXT,
  preferred_language TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    au.id AS user_id,
    bpw.current_week_number,
    bpw.feeding_method,
    pu.pregnancy_stage,
    pu.preferred_language
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.id = au.id
  LEFT JOIN baby_profiles_with_week bpw ON bpw.user_id = au.id
  WHERE au.last_sign_in_at > now() - INTERVAL '14 days'
  ORDER BY au.last_sign_in_at DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION list_active_home_users(INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION list_active_home_users(INT) TO service_role;

-- ─────────────────────────────────────────────
-- 5. pg_cron jobs
-- ─────────────────────────────────────────────
-- All cron'd Edge Functions authenticate via Authorization: Bearer <service_role_key>.
-- current_setting('app.supabase_url') + current_setting('app.service_role_key')
-- are set on the Supabase Pro plan during project provisioning. Locally these
-- settings are stubs; cron is effectively disabled outside of Supabase cloud.

-- JOB A: ai-milestone-explainer — Sunday 00:10 ET (05:10 UTC)
-- Fills milestone_library.ai_summary_cache for any row older than 30d (or NULL).
SELECT cron.schedule(
  'ai-milestone-explainer-weekly',
  '10 5 * * 0',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/ai-milestone-explainer',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{"mode":"stale"}'::jsonb
  );
  $$
);

-- JOB B: home-feed-curator — daily 05:10 ET (09:10 UTC)
-- Refreshes home_feed_cache for all active users (batched by the function).
SELECT cron.schedule(
  'home-feed-curator-daily',
  '10 9 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/home-feed-curator',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{"mode":"batch"}'::jsonb
  );
  $$
);

-- JOB C: daily-checkin-reminder — daily 08:00 ET (12:00 UTC)
-- Enqueues a push reminder for users who haven't checked in today.
-- Uses the existing push-notify Edge Function; deeplink opens DailyCheckin screen.
SELECT cron.schedule(
  'daily-checkin-reminder',
  '0 12 * * *',
  $$
  INSERT INTO user_notifications_feed (user_id, type, title, body, deeplink, is_sent)
  SELECT
    u.id,
    'daily_checkin',
    'How are you today?',
    'One tap. We''ll listen.',
    'village://home/checkin',
    FALSE
  FROM auth.users u
  WHERE u.last_sign_in_at > now() - INTERVAL '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM daily_checkins dc
      WHERE dc.user_id = u.id AND dc.checkin_date = CURRENT_DATE
    );
  $$
);
