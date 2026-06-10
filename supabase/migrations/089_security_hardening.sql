-- 089_security_hardening.sql
-- Security-advisor follow-up (2026-06-10). Clears the actionable lints that
-- appeared after migrations 072–088 added new functions/tables. Extends the
-- 051–054 hardening pass to the new surface area.
--
-- Scope:
--   1. spatial_ref_sys — enable RLS + public read policy to silence the
--      recurring `rls_disabled_in_public` ERROR. It's the PostGIS reference
--      table (public coordinate-system data, no user data); a permissive SELECT
--      policy keeps PostGIS working for every role. Wrapped so it no-ops if the
--      table is extension-owned and can't be altered.
--   2. Pin search_path on two newer functions flagged
--      `function_search_path_mutable` (behavior-preserving, mirrors 051).
--   3. Revoke anon EXECUTE on three in-app (post-login) RPCs flagged
--      `anon_security_definer_function_executable`. KEEPS authenticated +
--      service_role. Does NOT touch get_manual_video_share_meta or
--      get_specialist_invite_by_token (anon-callable by design).
--
-- Accepted (NOT touched, documented in CLAUDE.md): st_estimatedextent
-- (PostGIS), events_partner_feeds / specialist_invites (service-role-only
-- registries), avatars / gear-listings public buckets, leaked-password
-- protection (Pro-tier), the authenticated_* SECURITY DEFINER RPCs.

-- ── 1. spatial_ref_sys: enable RLS + permissive read (atomic; no-op if owned) ──
DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  CREATE POLICY spatial_ref_sys_public_read
    ON public.spatial_ref_sys FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN
  -- Extension-owned / already-policied: leave as-is, don't abort the migration.
  RAISE NOTICE 'spatial_ref_sys RLS skipped: %', SQLERRM;
END $$;

-- ── 2. Pin search_path on the two newly-flagged functions ─────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('auto_withdraw_p0_overdue_listings', 'manual_pieces_set_updated_at')
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_catalog', r.proname, r.args);
  END LOOP;
END $$;

-- ── 3. Revoke anon EXECUTE on in-app (post-login) RPCs ────────────────────────
-- These are only ever called by authenticated users (gear detail, manual piece
-- stream, "my" gear listings). Keeps authenticated + service_role grants.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_gear_listing', 'list_manual_pieces', 'list_my_gear_listings')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);
  END LOOP;
END $$;
