-- Tier 1 · migration 134 — permissive specialist read (audit 2026-09-04, finding R-3, HIGH)
--
-- THE BUG: migration 013 tried to drop a policy called
-- "Specialists are publicly readable". The policy actually created back in 002
-- was named `specialists_select_all`. `DROP POLICY IF EXISTS` swallowed the miss
-- silently, so the permissive USING (true) survived roughly 120 migrations —
-- while 015_v1_rls_audit.sql asserted the control was in place, which is exactly
-- why nobody noticed. Exposed: phone, address_line1, stripe_account_id and
-- admin_rejection_reason for pending and rejected practitioners.
--
-- ── A NOTE ON WHAT THIS TEST ASSERTS, AND WHY IT CHANGED ──────────────────
-- The first draft checked "anon cannot see a pending practitioner". That passed,
-- but for the WRONG REASON: the surviving SELECT policy is scoped TO
-- authenticated, so anon matches no policy at all and reads NOTHING from this
-- table — approved or not. The assertion would have stayed green even if the
-- admin_approved filter were deleted tomorrow.
--
-- So the two properties are now separated and each is asserted against a caller
-- for whom it can actually fail:
--   • anon           — has no read path to this table whatsoever (assertion 3,
--                      proved against an APPROVED row, which is the only row
--                      that could be visible if a read path existed)
--   • authenticated  — has a read path, and the admin_approved filter is what
--                      constrains it (assertions 4–7)
--
-- This is the failure mode the audit's own harness note warns about: a security
-- test that passes for an unrelated reason looks exactly like one that passes.

create extension if not exists pgtap;

begin;
select plan(8);

insert into public.specialists (id, full_name, credentials, specialty, admin_approved, phone, address_line1)
values
  ('22222222-2222-2222-2222-222222222221', 'Approved Midwife',   'CNM',  'midwife',              true,  '305-555-0101', '1 Approved Way'),
  ('22222222-2222-2222-2222-222222222222', 'Pending Doula',      'CD',   'doula',                false, '305-555-0102', '2 Pending Way'),
  ('22222222-2222-2222-2222-222222222223', 'Rejected Lactation', 'IBCLC','lactation_consultant', false, '305-555-0103', '3 Rejected Way');

-- ── the policy that must not come back ─────────────────────────────────────
select is_empty(
  $q$ select polname from pg_policy
       where polrelid = 'public.specialists'::regclass
         and polname = 'specialists_select_all' $q$,
  'the permissive specialists_select_all policy is gone'
);

-- Assert the surviving policy still FILTERS. "No SELECT policy at all" would
-- also hide the pending rows, and would also break the directory — a green test
-- must not be reachable that way.
select isnt_empty(
  $q$ select polname from pg_policy
       where polrelid = 'public.specialists'::regclass
         and polcmd = 'r'
         and pg_get_expr(polqual, polrelid) like '%admin_approved%' $q$,
  'the SELECT policy still filters on admin_approved'
);

-- ── anon: no read path at all ──────────────────────────────────────────────
-- Deliberately probed with the APPROVED row. anon still holds table-level
-- grants on this table; RLS is the only thing standing in the way, so this
-- asserts RLS is doing it.
set local role anon;

select results_eq(
  $q$ select count(*)::int from public.specialists
       where id = '22222222-2222-2222-2222-222222222221' $q$,
  $q$ values (0) $q$,
  'anon cannot read even an APPROVED practitioner — no anon policy exists'
);

-- ── authenticated: the filter is what constrains ───────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-2222222222ff","role":"authenticated"}';

select results_eq(
  $q$ select full_name from public.specialists
       where id = '22222222-2222-2222-2222-222222222221' $q$,
  $q$ values ('Approved Midwife'::text) $q$,
  'a signed-in user CAN see an approved practitioner — the directory works'
);

select results_eq(
  $q$ select count(*)::int from public.specialists
       where admin_approved = false $q$,
  $q$ values (0) $q$,
  'a signed-in user cannot see pending or rejected practitioners'
);

-- The finding was about the PII carried on those hidden rows, so assert on the
-- columns themselves rather than trusting a row count.
select is_empty(
  $q$ select phone from public.specialists where phone = '305-555-0102' $q$,
  'a pending practitioner''s phone number is unreachable'
);

select is_empty(
  $q$ select address_line1 from public.specialists where address_line1 = '3 Rejected Way' $q$,
  'a rejected practitioner''s street address is unreachable'
);

select is_empty(
  $q$ select admin_rejection_reason from public.specialists
       where admin_rejection_reason is not null $q$,
  'no rejection reason is readable by a signed-in user'
);

reset role;
select * from finish();
rollback;
