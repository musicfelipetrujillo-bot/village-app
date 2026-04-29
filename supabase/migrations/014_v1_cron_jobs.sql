-- V1 Phase 8: pg_cron jobs for SMS reminders + review summary refresh
-- Requires pg_cron extension (enabled on Supabase Pro; available in local dev via config)
-- All jobs call Edge Functions via http extension (pg_net)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─────────────────────────────────────────────
-- JOB 1: Appointment reminders — every 15 min
-- Calls appointment-reminder Edge Function which
-- finds 48h + 2h windows and sends Twilio SMS.
-- ─────────────────────────────────────────────
SELECT cron.schedule(
  'appointment-reminders',          -- job name (unique)
  '*/15 * * * *',                   -- every 15 minutes
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/appointment-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body   := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────
-- JOB 2: Review summary refresh — daily at 3am ET
-- Re-generates AI review summaries for any specialist
-- whose reviews have changed in the past 24h.
-- ─────────────────────────────────────────────
SELECT cron.schedule(
  'review-summary-refresh',
  '0 7 * * *',                      -- 3am ET = 7am UTC
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/refresh-stale-summaries',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body   := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────
-- JOB 3: Presence cleanup (reserved for V3 Community)
-- Deletes stale room_presence rows every 5 min
-- ─────────────────────────────────────────────
-- SELECT cron.schedule(
--   'presence-cleanup',
--   '*/5 * * * *',
--   $$ DELETE FROM room_presence WHERE last_seen_at < NOW() - INTERVAL '5 minutes'; $$
-- );

-- Helper function called by review-summary-refresh job
-- Finds specialists with new reviews in past 24h, queues summary refresh
CREATE OR REPLACE FUNCTION get_specialists_needing_summary_refresh()
RETURNS TABLE (specialist_id UUID) AS $$
  SELECT DISTINCT r.specialist_id
  FROM reviews r
  WHERE r.created_at > NOW() - INTERVAL '24 hours'
    AND (
      -- Never summarized
      NOT EXISTS (
        SELECT 1 FROM specialists s
        WHERE s.id = r.specialist_id AND s.review_summary_cache IS NOT NULL
      )
      OR
      -- Summary older than 24h
      EXISTS (
        SELECT 1 FROM specialists s
        WHERE s.id = r.specialist_id
          AND (s.review_summary_cached_at IS NULL OR s.review_summary_cached_at < NOW() - INTERVAL '24 hours')
      )
    );
$$ LANGUAGE SQL STABLE;
