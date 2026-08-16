-- 131_security_trending_revoke_public.sql
--
-- Completes migration 130, which did not actually remove anon's access.
--
-- WHAT WENT WRONG IN 130
-- ----------------------
-- 130 ran `REVOKE EXECUTE ... FROM anon` and verification showed `anon` could
-- STILL execute both functions. The ACL explains it:
--
--   get_trending_issue  →  {=X/postgres, postgres=X/postgres,
--                           authenticated=X/postgres, service_role=X/postgres}
--                           ^^^^^^^^^^^^
--                           an empty grantee means PUBLIC
--
-- These two functions carry a grant to **PUBLIC**, not a per-role grant to
-- `anon`. `anon` therefore holds EXECUTE by inheritance, and revoking it from
-- `anon` specifically removes a grant that was never there — a silent no-op.
--
-- THE RULE, because this repo has now been bitten from BOTH directions:
--   · Migration 052 revoked FROM PUBLIC only. That was a no-op, because
--     Supabase had issued explicit per-role grants. 054 had to fix it.
--   · Migration 130 revoked FROM anon only. Also a no-op, because here the
--     grant was to PUBLIC.
--
--   ⇒ Always revoke from BOTH: `FROM PUBLIC` *and* `FROM anon`. Neither alone
--     is sufficient, and which one is load-bearing depends on how the function
--     happened to be created. Then VERIFY with `pg_proc.proacl` — not with the
--     migration succeeding, which proves nothing.
--
-- Contrast `purge_expired_home_feed_cache` (migration 129), which did both and
-- has the clean ACL we want here: {postgres=X/postgres, service_role=X/postgres}.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_trending_issue(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_trending_archive()  FROM PUBLIC;

-- Belt and braces: 130 already did these, and they are harmless if the grant
-- is absent. Kept so this file is a complete statement of intent on its own.
REVOKE EXECUTE ON FUNCTION public.get_trending_issue(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_trending_archive()  FROM anon;

GRANT EXECUTE ON FUNCTION public.get_trending_issue(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_trending_archive()  TO authenticated, service_role;

COMMIT;
