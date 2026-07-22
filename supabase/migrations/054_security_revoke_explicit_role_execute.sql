-- Migration 054: Actually revoke EXECUTE from anon/authenticated.
--
-- Why: Migration 052 was a no-op. Supabase issues *explicit* default grants
-- to anon, authenticated, and service_role on every CREATE FUNCTION (not via
-- PUBLIC pseudo-role), so `REVOKE EXECUTE ... FROM PUBLIC` had nothing to
-- revoke. The 33 advisor lints from `anon_security_definer_function_executable`
-- were unchanged after 052.
--
-- Verification before writing this migration: queried `pg_proc.proacl` for a
-- sample of functions touched by 052 — every one still showed
-- `{postgres=X/postgres, anon=X/postgres, authenticated=X/postgres,
-- service_role=X/postgres}`. Hence: revoke from the explicit roles.
--
-- Pattern per function:
--   - mobile-callable: REVOKE FROM anon; (keep authenticated + service_role)
--   - service-role-only: REVOKE FROM anon, authenticated; (keep service_role)
--   - trigger-internal: REVOKE FROM anon, authenticated; (triggers don't
--     check EXECUTE; the postgres role still owns and can fire)
--
-- Risk: low. Anon callers hitting `/rest/v1/rpc/<fn>` get HTTP 401. App
-- already requires auth before any RPC call.

-- ────────────────────────────────────────────────────────────────────────────
-- Mobile-callable RPCs — revoke anon only; authenticated + service_role keep
-- ────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.claim_perk(p_deal_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_perks(p_age_tags text[], p_country text, p_category text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_my_claims() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_gear_listing(p_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_my_gear_listings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_my_saved_gear() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_gear_thread_read(p_thread_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_current_milestone() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_room_match() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_transaction_pickup_address(p_transaction_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_my_rsvps(p_past boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_weekly_journey(p_week integer, p_locale text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_room(p_room_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_room(p_room_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_rooms_for_discovery(p_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_room_messages(p_room_id uuid, p_limit integer, p_before timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_thread_read(p_thread_id uuid) FROM anon;

-- Admin / moderator / reviewer RPCs — also revoke anon (function body
-- still gates on the role check inside; this just blocks the HTTP surface).
REVOKE EXECUTE ON FUNCTION public.is_clinical_reviewer() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_event_reviewer() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_moderator_anywhere() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_pending_events() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_pending_review() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_open_crisis_flags_for_moderator() FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_crisis_flag(p_flag_id uuid, p_action text, p_notes text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_content_row(p_table text, p_id uuid, p_notes text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_content_row(p_table text, p_id uuid, p_notes text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_event(p_id uuid, p_notes text, p_age_tags text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_event(p_id uuid, p_notes text) FROM anon;

-- ────────────────────────────────────────────────────────────────────────────
-- Service-role-only — revoke anon AND authenticated
-- ────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.list_active_home_users(p_limit integer) FROM anon, authenticated;
-- See migration 104: rls_auto_enable() is backfilled there since it only
-- ever existed on hosted ad-hoc. Guard so a fresh reset doesn't fail here.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.verify_app_gucs() FROM anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Trigger-internal — revoke anon AND authenticated; triggers fire as the
-- function owner regardless and don't check EXECUTE
-- ────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scan_room_message_async() FROM anon, authenticated;
