-- Tier 1 · migration 133 — self-granted privileges (audit 2026-09-04, finding R-1, CRITICAL)
--
-- THE BUG: `users_update_own` scoped which ROW a caller could update and never
-- which COLUMNS, while Supabase's default table-wide GRANT UPDATE made every
-- column writable by its owner. The three privilege flags live on that same
-- self-writable row, so any signed-in user could grant herself Pro, or make
-- herself a clinical reviewer and publish unreviewed health content to everyone.
--
-- WHY THIS TEST INSPECTS THE ACL AND NOT JUST BEHAVIOUR: the first version of
-- migration 133 revoked from `anon` and `authenticated` but not from PUBLIC, and
-- its own verification block asked has_column_privilege — which reported the
-- column grants as correct while PUBLIC still held the whole table. It read like
-- a fix and enforced nothing. A REVOKE is not verified until the resulting ACL
-- has been looked at, so that is assertion #1.

create extension if not exists pgtap;

begin;
select plan(12);

insert into public.users (id, email, full_name)
values ('11111111-1111-1111-1111-111111111111', 'mom@example.test', 'Test Mom');

-- ── 1. the ACL itself ──────────────────────────────────────────────────────
-- grantee 0 is PUBLIC. Every role inherits PUBLIC, so a grant there defeats any
-- number of correct-looking per-role revokes.
select is_empty(
  $q$ select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end
        from pg_class c cross join lateral aclexplode(c.relacl) a
       where c.oid = 'public.users'::regclass
         and a.privilege_type = 'UPDATE'
         and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated')) $q$,
  'users: no table-wide UPDATE granted to PUBLIC, anon or authenticated'
);

-- ── 2. the column allowlist ────────────────────────────────────────────────
select ok(not has_column_privilege('authenticated', 'public.users', 'is_pro', 'UPDATE'),
          'users.is_pro is not writable by authenticated');
select ok(not has_column_privilege('authenticated', 'public.users', 'is_clinical_reviewer', 'UPDATE'),
          'users.is_clinical_reviewer is not writable by authenticated');
select ok(not has_column_privilege('authenticated', 'public.users', 'is_event_reviewer', 'UPDATE'),
          'users.is_event_reviewer is not writable by authenticated');
select ok(not has_column_privilege('authenticated', 'public.users', 'email', 'UPDATE'),
          'users.email is not writable by authenticated (account-takeover vector)');
select ok(has_column_privilege('authenticated', 'public.users', 'full_name', 'UPDATE'),
          'users.full_name IS still writable — the legitimate profile path survives');

-- ── 3. the attacks, executed ───────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok(
  $q$ update public.users set is_pro = true
       where id = '11111111-1111-1111-1111-111111111111' $q$,
  '42501', null,
  'a signed-in user cannot grant herself Pro'
);

select throws_ok(
  $q$ update public.users set is_clinical_reviewer = true
       where id = '11111111-1111-1111-1111-111111111111' $q$,
  '42501', null,
  'a signed-in user cannot make herself a clinical reviewer'
);

select throws_ok(
  $q$ update public.users set email = 'attacker@example.test'
       where id = '11111111-1111-1111-1111-111111111111' $q$,
  '42501', null,
  'a signed-in user cannot rewrite her own email row-side'
);

-- ── 4. the product still works ─────────────────────────────────────────────
-- A security test that only proves things are refused cannot tell "locked down"
-- from "broken". These two assert the ordinary path is intact.
select lives_ok(
  $q$ update public.users set full_name = 'Renamed Mom', zip_code = '33101'
       where id = '11111111-1111-1111-1111-111111111111' $q$,
  'an ordinary profile edit still succeeds'
);

select results_eq(
  $q$ select full_name from public.users
       where id = '11111111-1111-1111-1111-111111111111' $q$,
  $q$ values ('Renamed Mom'::text) $q$,
  'the profile edit actually persisted (RLS did not silently match zero rows)'
);

select results_eq(
  $q$ select is_pro from public.users
       where id = '11111111-1111-1111-1111-111111111111' $q$,
  $q$ values (false) $q$,
  'clients can still READ is_pro — only writing it is blocked'
);

reset role;
select * from finish();
rollback;
