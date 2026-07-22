-- Migration 052: Revoke anon EXECUTE on app-owned SECURITY DEFINER RPCs.
--
-- Why: Supabase advisor flags 33 app-owned SECURITY DEFINER functions as
-- callable from the `anon` role via PostgREST (`/rest/v1/rpc/<fn>`). Every
-- one of these is intended for either an authenticated mobile user, a
-- service-role cron, or an internal trigger — none should be reachable
-- before login. Default `CREATE FUNCTION` grants EXECUTE to PUBLIC, which
-- is why anon inherits access. We revoke from PUBLIC and re-grant to the
-- specific roles that actually need it.
--
-- Categorization rules (applied per-function below):
--   - **mobile-callable** (28 fns): GRANT EXECUTE TO authenticated, service_role
--   - **service-role-only** (3 fns: list_active_home_users, rls_auto_enable,
--     verify_app_gucs): GRANT EXECUTE TO service_role only
--   - **trigger-internal** (2 fns: handle_new_auth_user, scan_room_message_async):
--     no grant — triggers don't check EXECUTE privilege; the function
--     remains callable from its trigger context regardless of role grants.
--
-- PostGIS internals (`st_estimatedextent` × 3 overloads) also flagged but
-- are extension-owned (postgis); we cannot ALTER them safely. They remain.
--
-- Risk: low — no behavior change for authenticated callers; anon callers
-- previously hitting `/rest/v1/rpc/<fn>` (which the app does not do) now
-- get HTTP 401 instead of executing.

-- ────────────────────────────────────────────────────────────────────────────
-- Mobile-callable RPCs — authenticated + service_role only
-- ────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.claim_perk(p_deal_id uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_perk(p_deal_id uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_perks(p_age_tags text[], p_country text, p_category text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_perks(p_age_tags text[], p_country text, p_category text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_my_claims() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_my_claims() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_gear_listing(p_id uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_gear_listing(p_id uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_my_gear_listings() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_my_gear_listings() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_my_saved_gear() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_my_saved_gear() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_gear_thread_read(p_thread_id uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_gear_thread_read(p_thread_id uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_my_current_milestone() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_current_milestone() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_my_room_match() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_room_match() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_transaction_pickup_address(p_transaction_id uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_transaction_pickup_address(p_transaction_id uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_my_rsvps(p_past boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_my_rsvps(p_past boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_weekly_journey(p_week integer, p_locale text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_weekly_journey(p_week integer, p_locale text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.join_room(p_room_id uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.join_room(p_room_id uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.leave_room(p_room_id uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.leave_room(p_room_id uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_rooms_for_discovery(p_user_id uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_rooms_for_discovery(p_user_id uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_room_messages(p_room_id uuid, p_limit integer, p_before timestamp with time zone) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_room_messages(p_room_id uuid, p_limit integer, p_before timestamp with time zone) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_thread_read(p_thread_id uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_thread_read(p_thread_id uuid) TO authenticated, service_role;

-- Admin / moderator / reviewer RPCs — authenticated only; the function body
-- already enforces the role check (e.g. is_clinical_reviewer / is_moderator_anywhere
-- guards), so authenticated-but-not-privileged callers still get rejected
-- inside the function. Goal here is to slam the door on the anon RPC URL.
REVOKE EXECUTE ON FUNCTION public.is_clinical_reviewer() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_clinical_reviewer() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_event_reviewer() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_event_reviewer() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_moderator_anywhere() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_moderator_anywhere() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_pending_events() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_pending_events() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_pending_review() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_pending_review() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_open_crisis_flags_for_moderator() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_open_crisis_flags_for_moderator() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_crisis_flag(p_flag_id uuid, p_action text, p_notes text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resolve_crisis_flag(p_flag_id uuid, p_action text, p_notes text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.approve_content_row(p_table text, p_id uuid, p_notes text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.approve_content_row(p_table text, p_id uuid, p_notes text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reject_content_row(p_table text, p_id uuid, p_notes text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reject_content_row(p_table text, p_id uuid, p_notes text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.approve_event(p_id uuid, p_notes text, p_age_tags text[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.approve_event(p_id uuid, p_notes text, p_age_tags text[]) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reject_event(p_id uuid, p_notes text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reject_event(p_id uuid, p_notes text) TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- Service-role-only — cron / DB ops; mobile and admin should never call these
-- ────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.list_active_home_users(p_limit integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_active_home_users(p_limit integer) TO service_role;

-- rls_auto_enable() is backfilled retroactively in migration 104 (it existed
-- on hosted ad-hoc, never via a migration, so a fresh reset doesn't have it
-- yet at this point). Guard so this doesn't hard-fail on a clean clone --
-- migration 104 reasserts the correct service-role-only grant regardless.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.verify_app_gucs() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.verify_app_gucs() TO service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- Trigger-internal — fires from a trigger context; revoking EXECUTE from
-- PUBLIC does NOT break the trigger because Postgres triggers don't check
-- EXECUTE privilege at fire time. No grant needed.
-- ────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scan_room_message_async() FROM PUBLIC;
