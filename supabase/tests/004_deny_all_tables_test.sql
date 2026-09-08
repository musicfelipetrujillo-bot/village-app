-- Tier 1 · deny-all tables and the quota ledger
--
-- Three tables are meant to be unreachable from any client session:
--
--   crisis_flags              — self-harm classifier verdicts on real messages
--   user_anonymous_identities — the map from an alias back to a real user
--   ai_rate_limits            — the per-user spend ledger (migration 135)
--
-- The first two carry an explicit USING (false) policy, verified end-to-end when
-- V3 C1 shipped. The third uses the "RLS on, no policy" shape.
--
-- A NOTE ON ai_rate_limits, AND WHY THIS FILE CHANGED.
-- This test was first written to assert only that a client sees ZERO ROWS,
-- because that was all that was true: migration 135 revoked EXECUTE on
-- consume_ai_quota but never revoked table privileges, so anon and authenticated
-- still held full table grants and only the empty RLS policy set stood in the
-- way. Writing the test honestly is what exposed the gap — the stricter claim
-- would have failed, and for a reason unrelated to the security property.
-- Migration 137 closed it, so the assertion is now the stricter one: permission
-- denied, at the grant layer, before RLS is even consulted.

create extension if not exists pgtap;

begin;
select plan(11);

-- ai_rate_limits.user_id references auth.users, so the fixture starts there;
-- the migration-044 trigger mirrors the row into public.users.
insert into auth.users (id, email)
values ('44444444-4444-4444-4444-444444444441', 'reader@example.test');

-- Seed one row in each table as the owner, so "zero rows visible" cannot pass
-- merely because the table is empty. This is the failure mode that made an
-- earlier hand-written harness look green while proving nothing.
insert into public.ai_rate_limits (user_id, fn, window_start, call_count)
values ('44444444-4444-4444-4444-444444444441', 'ai-triage', now(), 3);

select results_eq(
  $q$ select count(*)::int from public.ai_rate_limits $q$,
  $q$ values (1) $q$,
  'fixture present: the ledger has a row to hide'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444441","role":"authenticated"}';

select throws_ok(
  $q$ select count(*)::int from public.ai_rate_limits $q$,
  '42501', null,
  'a signed-in user is DENIED on the quota ledger (migration 137, grant layer)'
);

select throws_ok(
  $q$ insert into public.ai_rate_limits (user_id, fn, window_start, call_count)
      values ('44444444-4444-4444-4444-444444444441', 'ai-triage', now(), 0) $q$,
  '42501', null,
  'a signed-in user cannot write to the quota ledger (no self-reset)'
);

select ok(not has_function_privilege('authenticated',
            'public.consume_ai_quota(uuid, text, int, int)', 'EXECUTE'),
          'authenticated cannot execute consume_ai_quota');

select ok(not has_function_privilege('anon',
            'public.consume_ai_quota(uuid, text, int, int)', 'EXECUTE'),
          'anon cannot execute consume_ai_quota');

select ok(has_function_privilege('service_role',
            'public.consume_ai_quota(uuid, text, int, int)', 'EXECUTE'),
          'service_role CAN execute it — the limiter still works');

-- ── the USING(false) pair ──────────────────────────────────────────────────
select results_eq(
  $q$ select count(*)::int from public.crisis_flags $q$,
  $q$ values (0) $q$,
  'crisis_flags is unreadable by a signed-in user'
);

select results_eq(
  $q$ select count(*)::int from public.user_anonymous_identities $q$,
  $q$ values (0) $q$,
  'user_anonymous_identities is unreadable by a signed-in user'
);

reset role;

select results_eq(
  $q$ select count(*)::int from pg_policy
       where polrelid in ('public.crisis_flags'::regclass,
                          'public.user_anonymous_identities'::regclass)
         and pg_get_expr(polqual, polrelid) = 'false' $q$,
  $q$ values (2) $q$,
  'both tables still carry an explicit USING(false) policy'
);

-- The ACL itself, checked directly. A REVOKE is not verified until the resulting
-- ACL has been looked at: migrations 052, 130 and the first 133 all succeeded
-- while enforcing nothing. An entry with an empty grantee IS PUBLIC.
select is_empty(
  $q$ select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end
        from pg_class c cross join lateral aclexplode(c.relacl) a
       where c.oid = 'public.ai_rate_limits'::regclass
         and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated')) $q$,
  'ai_rate_limits grants nothing to PUBLIC, anon or authenticated'
);

-- And the limiter still works. Without this, "nobody can touch the table" would
-- look like a pass while the rate limiter was broken — the revoke is only safe
-- because consume_ai_quota is SECURITY DEFINER and runs as the owner.
select results_eq(
  $q$ select prosecdef from pg_proc where proname = 'consume_ai_quota' $q$,
  $q$ values (true) $q$,
  'consume_ai_quota is SECURITY DEFINER, so the revoke cannot break the limiter'
);

select * from finish();
rollback;
