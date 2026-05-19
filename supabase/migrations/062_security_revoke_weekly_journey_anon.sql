-- Migration 062: Re-revoke anon EXECUTE on get_weekly_journey.
--
-- Background:
--   * Migration 036 originally defined `get_weekly_journey(p_week INT, p_locale
--     TEXT DEFAULT 'en')` with `GRANT EXECUTE ... TO authenticated, anon` —
--     the function is a public read of approved weekly-journey content.
--   * Migration 052 attempted `REVOKE EXECUTE ... FROM PUBLIC` but that was
--     a no-op (Supabase issues explicit per-role grants, not via PUBLIC).
--   * Migration 054 then explicitly `REVOKE EXECUTE ... FROM anon` to fix
--     052's no-op. That should have stuck.
--   * Today's audit (2026-05-17) shows the function's `pg_proc.proacl` still
--     carries `anon=X/postgres`. Reason unknown — either 054 didn't fully
--     apply for this function, or a manual re-grant happened.
--
-- Fix: re-issue the anon revoke. The function stays callable by authenticated
-- + service_role (mobile app + internal cron). No data-shape change; only
-- the role allowlist tightens.
--
-- Risk: low. The mobile app calls this RPC only after auth (every code path
-- gates on `useAuthStore.user`). Anon traffic hitting `/rest/v1/rpc/
-- get_weekly_journey` already had no business there and now gets HTTP 401.

REVOKE EXECUTE ON FUNCTION public.get_weekly_journey(p_week INT, p_locale TEXT) FROM anon;

-- Defense-in-depth: also re-affirm the kept grants explicitly so the ACL
-- ends in a known shape even if some other grant source drifts in the future.
GRANT  EXECUTE ON FUNCTION public.get_weekly_journey(p_week INT, p_locale TEXT) TO authenticated, service_role;
