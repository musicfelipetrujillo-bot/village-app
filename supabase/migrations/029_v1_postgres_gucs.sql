-- 029_v1_postgres_gucs.sql
-- Verification helpers for the Postgres GUCs that pg_net-based triggers and
-- cron jobs depend on. We do NOT set the GUCs here — those must be set by
-- the operator per-environment (see docs/PRE_LAUNCH_RUNBOOK.md §2.3):
--
--   ALTER DATABASE postgres SET app.supabase_url     = '<project url>';
--   ALTER DATABASE postgres SET app.service_role_key = '<service role jwt>';
--
-- For local development, supabase/seed.sql sets these to the local CLI defaults.

-- Returns one row per required GUC, with the current value (NULL if unset).
-- Use this in smoke tests or admin tooling to fail loudly instead of silently.
CREATE OR REPLACE FUNCTION public.verify_app_gucs()
RETURNS TABLE (guc_name TEXT, is_set BOOLEAN, current_value TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'app.supabase_url'::TEXT,
    current_setting('app.supabase_url', TRUE) IS NOT NULL
      AND current_setting('app.supabase_url', TRUE) <> '',
    -- safe to return — it's just the project URL, not a secret
    current_setting('app.supabase_url', TRUE);

  RETURN QUERY
  SELECT
    'app.service_role_key'::TEXT,
    current_setting('app.service_role_key', TRUE) IS NOT NULL
      AND current_setting('app.service_role_key', TRUE) <> '',
    -- redact value — it's a service role JWT
    CASE
      WHEN current_setting('app.service_role_key', TRUE) IS NULL
        OR current_setting('app.service_role_key', TRUE) = ''
        THEN NULL
      ELSE '<redacted, length=' || length(current_setting('app.service_role_key', TRUE))::TEXT || '>'
    END;
END;
$$;

COMMENT ON FUNCTION public.verify_app_gucs() IS
  'Returns required Postgres GUCs and whether each is set. Used to validate that pg_net-based triggers and cron jobs will be able to call back into Edge Functions. See docs/PRE_LAUNCH_RUNBOOK.md §2.3.';

-- Convenience: raise NOTICE on any missing GUCs at migration time so deploys
-- which forget to set them get a visible warning in the migration log.
DO $$
DECLARE
  missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF current_setting('app.supabase_url', TRUE) IS NULL
     OR current_setting('app.supabase_url', TRUE) = '' THEN
    missing := array_append(missing, 'app.supabase_url');
  END IF;

  IF current_setting('app.service_role_key', TRUE) IS NULL
     OR current_setting('app.service_role_key', TRUE) = '' THEN
    missing := array_append(missing, 'app.service_role_key');
  END IF;

  IF array_length(missing, 1) > 0 THEN
    RAISE WARNING
      'Required Postgres GUCs are not set: %. Cron jobs and async triggers (e.g. crisis detection in V3 C4) will silently no-op until these are configured. See docs/PRE_LAUNCH_RUNBOOK.md §2.3.',
      array_to_string(missing, ', ');
  END IF;
END $$;
