-- 137 · Revoke client grants on the AI quota ledger.
--
-- WHAT THIS FIXES
-- Migration 135 created `ai_rate_limits` with the deliberate "RLS on, no policy"
-- shape and revoked EXECUTE on `consume_ai_quota` from public/anon/authenticated.
-- It never revoked anything on the TABLE. Supabase's defaults therefore left
-- `anon` and `authenticated` holding full table privileges:
--
--   {postgres=arwdDxt/postgres, anon=arwdDxt/postgres,
--    authenticated=arwdDxt/postgres, service_role=arwdDxt/postgres}
--
-- NOT EXPLOITABLE TODAY, and this migration is defence in depth rather than a
-- fix for a live hole: RLS is enabled with zero policies, so a client SELECT
-- returns zero rows and any INSERT/UPDATE/DELETE raises. The grant is only
-- reachable if someone later adds a policy to this table "to debug something"
-- and unknowingly hands clients the whole ledger — at which point a user could
-- read every user's usage, or reset her own counter and spend without limit.
--
-- Found 2026-09-08 while writing the tier-1 database assertions: the test for
-- this table had to be written against "no rows visible" rather than "permission
-- denied", which is what exposed the gap. The audit record for 135 states it
-- "already revoked from public+anon+authenticated" — true of the FUNCTION, not
-- of the table. Recording that here so the next reader does not have to re-derive
-- the difference.
--
-- THE SECURITY DEFINER FUNCTION IS UNAFFECTED. `consume_ai_quota` is
-- SECURITY DEFINER (135:84), so it executes with the owner's privileges and
-- keeps full access to the table regardless of what the calling role holds.
-- Nothing else in the codebase touches `ai_rate_limits`: the only references are
-- inside `_shared/rate-limit.ts`, and every one of them goes through the RPC.
-- So the rate limiter continues to work exactly as before.

begin;

-- REVOKE FROM PUBLIC **AND** FROM THE ROLES.
-- This project has been bitten by getting that wrong twice in both directions:
-- migration 052 revoked FROM PUBLIC only and was a no-op because the grants were
-- role-specific; migration 130 revoked FROM anon only and was a no-op because the
-- grant was to PUBLIC (fixed by 131); and the first version of 133 revoked from
-- the roles but not PUBLIC, leaving the privilege-escalation UPDATE working while
-- reading like a fix. Neither form alone is sufficient. An ACL entry with an
-- empty grantee IS PUBLIC, and every role inherits it.
revoke all privileges on table public.ai_rate_limits from public, anon, authenticated;

-- service_role keeps its grant. Nothing depends on it today (the RPC is
-- SECURITY DEFINER), but the deny-all tables in this schema all keep the
-- service_role grant so an ops query does not need a migration to run.
grant all privileges on table public.ai_rate_limits to service_role;

commit;

-- ── Verification (run after apply) ──
-- A REVOKE IS NOT VERIFIED UNTIL YOU HAVE LOOKED AT THE RESULTING ACL. The
-- migration succeeding proves nothing — 052, 130 and 133 all succeeded while
-- enforcing nothing. Expect exactly two entries, and NO leading `=` entry
-- (an empty grantee means PUBLIC):
--
--   select unnest(relacl)::text from pg_class where relname = 'ai_rate_limits';
--     → postgres=arwdDxt/postgres
--     → service_role=arwdDxt/postgres
--
-- And the behaviour, which is what actually matters:
--
--   set role authenticated;
--   select count(*) from public.ai_rate_limits;   → ERROR: permission denied
--   reset role;
--
-- Note this CHANGES the failure mode from "returns zero rows" to "permission
-- denied". `supabase/tests/004_deny_all_tables_test.sql` asserts the stricter
-- behaviour from this migration forward; the comment in that file explains why
-- it previously asserted the weaker one.
