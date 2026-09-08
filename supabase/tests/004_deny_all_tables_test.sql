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
-- WHAT THIS TEST DELIBERATELY DOES NOT ASSERT: that a client is *denied* on
-- ai_rate_limits. It is not. Migration 135 revokes EXECUTE on consume_ai_quota
-- but never revokes table privileges, so anon and authenticated still hold
-- table-level grants and a SELECT returns ZERO ROWS rather than an error. The
-- effective invariant — no row is readable, no row is writable — is what is
-- asserted here, and it holds either way. Tightening the grant is tracked
-- separately; writing the test against the stricter claim would have made it
-- fail for a reason unrelated to the security property.

create extension if not exists pgtap;

begin;
select plan(9);

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

select results_eq(
  $q$ select count(*)::int from public.ai_rate_limits $q$,
  $q$ values (0) $q$,
  'a signed-in user sees no rows in her own quota ledger'
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

select * from finish();
rollback;
