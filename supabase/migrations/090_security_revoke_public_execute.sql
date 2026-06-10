-- 090_security_revoke_public_execute.sql
-- Follow-up to 089. get_gear_listing + list_my_gear_listings are SECURITY
-- DEFINER and were created with a PUBLIC execute grant (`=X`), so anon could
-- reach them THROUGH PUBLIC even after 089 revoked the explicit anon grant.
-- Revoke PUBLIC; authenticated + service_role keep their explicit grants, so
-- the in-app (post-login) callers are unaffected.
--
-- Verified anon-reachable SECURITY DEFINER set left intentionally:
--   • get_manual_video_share_meta — anon by design (share-preview crawler)
--   • get_specialist_invite_by_token — anon by design (invite-link lookup)
--   • st_estimatedextent (×3) — PostGIS extension-owned, cannot ALTER. Accept.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_gear_listing', 'list_my_gear_listings')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', r.proname, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);
    -- Keep the surfaces the app actually uses.
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, r.args);
  END LOOP;
END $$;
