-- Migration 104: Backfill public.rls_auto_enable() + its event trigger.
--
-- Why: This function and its event trigger exist on the hosted project but
-- were created ad-hoc (Studio / manual SQL) and never captured in a
-- migration file. Migrations 052 and 054 both REVOKE/GRANT EXECUTE on
-- public.rls_auto_enable(), assuming it already exists -- which is true on
-- hosted, but false on a fresh clone. `supabase db reset` from a clean
-- checkout fails at migration 052 with:
--   ERROR: function public.rls_auto_enable() does not exist
--
-- What it does: an event-trigger safety net that fires on CREATE TABLE /
-- CREATE TABLE AS / SELECT INTO in the public schema and force-enables RLS
-- on the new table, so a forgotten `ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY` can't ship a world-readable table. Definition below is captured
-- verbatim from the hosted project via `pg_get_functiondef`.
--
-- This migration is idempotent: CREATE OR REPLACE for the function, an
-- existence guard for the event trigger, so it is a no-op on hosted (where
-- both already exist) and fully establishes both on a fresh local reset.
-- Migrations 052/054 have also been given existence guards around their
-- rls_auto_enable references so they no longer hard-fail when this
-- migration hasn't run yet (i.e. on a fresh reset, before this file runs).
-- The final REVOKE/GRANT below reasserts the service-role-only grant
-- 052/054 intended, regardless of run order.

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    CREATE EVENT TRIGGER ensure_rls
      ON ddl_command_end
      WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      EXECUTE FUNCTION public.rls_auto_enable();
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
