-- Tier 1 · migration 136 — room message integrity (audit 2026-09-04, batch 8)
--
-- Connect is hidden in the app, but RLS has been enforcing since migration 040
-- and room_messages is reachable through PostgREST with any authenticated
-- session, so this surface is live on hosted. Three vectors, all now closed:
--
--  1. message_type was never constrained on INSERT. The scan trigger treats
--     system / ai_companion / expert as trusted and marks them `clear` inline
--     WITHOUT calling the classifier — so a member could post as an `expert`,
--     skip the self-harm screen entirely, and render under the gold
--     "Villie · AI companion" badge to an audience of postpartum mothers.
--
--  2. ai_scan_status was never constrained either. The trigger's first line is
--     `IF NEW.ai_scan_status <> 'pending' THEN RETURN NEW`, so inserting an
--     ordinary user message already marked `clear` skipped the scan with no
--     impersonation required. This was the simplest bypass and would have
--     survived a fix that only addressed message_type.
--
--  3. UPDATE was row-scoped but never column-scoped, so a sender could release
--     her own message after the classifier held it, or edit the body after the
--     scan cleared it.
--
-- The UPDATE policy was DROPPED rather than narrowed — no client code updates
-- this table — so assertion #7 is that no UPDATE policy exists at all.

create extension if not exists pgtap;

begin;
select plan(8);

-- room_members.user_id references auth.users, so the fixture starts there.
-- The migration-044 trigger mirrors the row into public.users for us.
insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333331', 'member@example.test');

insert into public.rooms (id, slug, name, description, room_type)
values ('33333333-3333-3333-3333-33333333aaaa', 'test-room', 'Test Room', 'fixture', 'topic');

insert into public.room_members (room_id, user_id)
values ('33333333-3333-3333-3333-33333333aaaa', '33333333-3333-3333-3333-333333333331');

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333331","role":"authenticated"}';

-- ── vector 1: impersonating a trusted sender ───────────────────────────────
select throws_ok(
  $q$ insert into public.room_messages (room_id, sender_user_id, body, message_type)
      values ('33333333-3333-3333-3333-33333333aaaa',
              '33333333-3333-3333-3333-333333333331', 'trust me', 'expert') $q$,
  '42501', null,
  'a member cannot post as an expert (skips the self-harm scan)'
);

select throws_ok(
  $q$ insert into public.room_messages (room_id, sender_user_id, body, message_type)
      values ('33333333-3333-3333-3333-33333333aaaa',
              '33333333-3333-3333-3333-333333333331', 'i am the AI', 'ai_companion') $q$,
  '42501', null,
  'a member cannot post under the AI companion badge'
);

select throws_ok(
  $q$ insert into public.room_messages (room_id, sender_user_id, body, message_type)
      values ('33333333-3333-3333-3333-33333333aaaa',
              '33333333-3333-3333-3333-333333333331', 'official notice', 'system') $q$,
  '42501', null,
  'a member cannot post an official system card'
);

-- ── vector 2: pre-clearing your own message ────────────────────────────────
select throws_ok(
  $q$ insert into public.room_messages (room_id, sender_user_id, body, ai_scan_status)
      values ('33333333-3333-3333-3333-33333333aaaa',
              '33333333-3333-3333-3333-333333333331', 'unscanned', 'clear') $q$,
  '42501', null,
  'a member cannot insert a message already marked scanned-clear'
);

-- ── the legitimate path ────────────────────────────────────────────────────
select lives_ok(
  $q$ insert into public.room_messages (room_id, sender_user_id, body)
      values ('33333333-3333-3333-3333-33333333aaaa',
              '33333333-3333-3333-3333-333333333331', 'hello everyone') $q$,
  'an ordinary member message still posts'
);

select results_eq(
  $q$ select message_type, ai_scan_status from public.room_messages
       where body = 'hello everyone' $q$,
  $q$ values ('user'::text, 'pending'::text) $q$,
  'it lands as an unscanned user message, which is what the classifier expects'
);

-- ── vector 3: no UPDATE path at all ────────────────────────────────────────
reset role;

select is_empty(
  $q$ select polname from pg_policy
       where polrelid = 'public.room_messages'::regclass and polcmd = 'w' $q$,
  'room_messages has no UPDATE policy — scan-then-swap is unreachable'
);

-- ── trusted producers are untouched ────────────────────────────────────────
-- The fix must not break the real ai_companion / system writers, which run as
-- service_role. Without this, "nobody can post" would look like a pass.
set local role service_role;

select lives_ok(
  $q$ insert into public.room_messages (room_id, sender_user_id, body, message_type, ai_scan_status)
      values ('33333333-3333-3333-3333-33333333aaaa', null,
              'Weekly digest', 'system', 'clear') $q$,
  'service_role can still write a trusted system message'
);

reset role;
select * from finish();
rollback;
