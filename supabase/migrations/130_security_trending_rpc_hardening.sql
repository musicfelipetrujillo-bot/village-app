-- 130_security_trending_rpc_hardening.sql
--
-- Closes the last two `function_search_path_mutable` advisor lints, and brings
-- The Buzz's two read RPCs in line with the convention every other mobile RPC
-- already follows.
--
-- WHY THESE TWO WERE MISSED
-- -------------------------
-- Migration 051 pinned `search_path` on 42 functions and 052/054 revoked `anon`
-- EXECUTE across the mobile RPC surface. `get_trending_issue` and
-- `list_trending_archive` arrived later, in migration 105 (The Buzz), so they
-- were never swept. They have been the only two functions on the advisor's
-- `function_search_path_mutable` list ever since.
--
-- HOW BAD WAS IT? Honestly: not very, and this is hardening rather than a fix.
-- Both are SECURITY INVOKER (`prosecdef = false`), so they run with the
-- caller's own privileges — a search_path hijack cannot escalate anything,
-- which is the actual danger the lint exists to catch on SECURITY DEFINER
-- functions. Recorded plainly so nobody later reads "security migration" and
-- assumes there was an exposure.
--
-- WHAT THIS CHANGES
-- -----------------
-- 1. Pins `search_path` on both, via ALTER FUNCTION. This does NOT touch the
--    function body — deliberately. `CREATE OR REPLACE` on a plpgsql function is
--    a whole-body replace, and migration 118 already shipped a silent feature
--    revert to this database that way by rewriting from a stale ancestor.
--    ALTER FUNCTION cannot make that mistake.
--
-- 2. Revokes `anon` EXECUTE, matching migration 054. Verified before writing:
--    the only callers are `apps/mobile/src/api/theBuzz.ts`, which runs
--    authenticated, and none of the four public `trending-*` edge functions
--    touch these RPCs (they write via the service role). No anon caller exists.
--
--    Useful side effect: an un-tokened read was previously evaluated as `anon`
--    and returned 200 with an empty list — the silent-empty trap documented for
--    this codebase, where "not logged in yet" is indistinguishable from "no
--    content". With anon EXECUTE revoked it fails loudly instead, which is the
--    behaviour we want.

BEGIN;

ALTER FUNCTION public.get_trending_issue(uuid)  SET search_path = public, pg_catalog;
ALTER FUNCTION public.list_trending_archive()   SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.get_trending_issue(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_trending_archive()  FROM anon;

-- Re-affirm the intended grants (idempotent; mirrors 052/054).
GRANT EXECUTE ON FUNCTION public.get_trending_issue(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_trending_archive()  TO authenticated, service_role;

COMMIT;
