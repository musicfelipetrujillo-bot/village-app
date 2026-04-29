-- V4 Phase B — Weekly Journey AI backfill cron
--
-- Schedules `ai-weekly-journey-fill` to run nightly until weeks 13–104 are
-- populated. The function is self-limiting (default limit=5 weeks/run) and
-- skips weeks that already have content, so once the backfill is complete
-- this becomes a no-op nightly health-check.
--
-- Once weeks 13–104 are filled + clinical-advisor-approved we can either:
--   (a) leave the cron in place — it just no-ops, no API spend
--   (b) `SELECT cron.unschedule('ai-weekly-journey-fill-nightly');`
--
-- Generated rows ALWAYS land as `review_status='pending'` /
-- `clinical_advisor_reviewed=FALSE`. Public RLS only exposes 'approved'
-- rows, so users see nothing until clinical advisor flips each row via the
-- review dashboard. **Do not flip the cron's `limit` higher than 10**
-- without batching — Edge Function timeouts are real (~150s) and Sonnet
-- runs ~10–15s per week.
--
-- Pre-launch gates (must be set on Supabase Pro):
--   - app.supabase_url           (matches SUPABASE_URL secret)
--   - app.service_role_key       (matches SUPABASE_SERVICE_ROLE_KEY secret)
--   - ANTHROPIC_API_KEY          set as edge function secret
--   - pg_cron + pg_net extensions enabled (already there per migration 025)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    -- Defensive: drop the job if a prior version exists (e.g. re-running
    -- this migration in a dev reset). cron.unschedule errors if missing,
    -- so guard with a lookup.
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-weekly-journey-fill-nightly') THEN
      PERFORM cron.unschedule('ai-weekly-journey-fill-nightly');
    END IF;

    -- 04:00 UTC = 00:00 ET. Off-peak so it doesn't compete with G7 home-feed
    -- curator (09:10 UTC) or milestone-explainer-weekly (05:10 UTC Sunday).
    PERFORM cron.schedule(
      'ai-weekly-journey-fill-nightly',
      '0 4 * * *',
      $cron$
      SELECT net.http_post(
        url     := current_setting('app.supabase_url') || '/functions/v1/ai-weekly-journey-fill',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body    := '{"mode":"missing","limit":5}'::jsonb
      );
      $cron$
    );
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- app.supabase_url / app.service_role_key not set in this environment.
    -- Cron schedule still gets registered above; it'll fail at runtime with
    -- a clear error message rather than blocking the migration.
    NULL;
END $$;
