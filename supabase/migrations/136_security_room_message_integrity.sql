-- 136_security_room_message_integrity.sql
-- SECURITY (high) — stop room members impersonating trusted senders and bypassing
-- the C4 crisis/moderation scan.
--
-- Context: the Connect tab is hidden in AppNavigator, so nobody is exposed via the
-- app today. The surface is nonetheless LIVE on hosted — RLS has been enforcing
-- since migration 040 and `room_messages` is reachable through PostgREST with any
-- authenticated session. This is a pre-launch gate: Connect must not be un-hidden
-- until this lands.
--
-- ═══ HOLE 1 — INSERT does not constrain `message_type` ═══════════════════════
--   `messages_insert_members` (007_v3_community_rls.sql:52-61) checks only that
--   the sender is the caller and that the caller is a room member. `message_type`
--   is left to the client, and the column accepts
--   'user' | 'system' | 'ai_companion' | 'expert' (006:76-77).
--
--   Two consequences, both bad:
--
--   (a) SCAN BYPASS. `scan_room_message_async()` (027:115-120) treats those three
--       types as trusted and marks them `ai_scan_status='clear'` INLINE, without
--       ever calling `room-message-scan`. So a member posting as 'expert' skips
--       the Haiku crisis + moderation classifier entirely — in a
--       maternal-mental-health chat whose whole safety model is that every user
--       message is screened for self-harm before anyone sees it.
--
--   (b) CLINICAL-AUTHORITY IMPERSONATION. RoomChatScreen renders 'ai_companion'
--       with the gold "✨ Villie · AI companion" badge and 'system' as an official
--       digest card. A member could post medical instructions that render as
--       though they came from Villie or a vetted expert, to an audience of
--       postpartum mothers, unscanned.
--
-- ═══ HOLE 2 — INSERT does not constrain `ai_scan_status` ═════════════════════
--   Independent of message_type. The trigger's FIRST statement is
--       IF NEW.ai_scan_status <> 'pending' THEN RETURN NEW;
--   (027:111-113) — an idempotency guard so re-runs don't re-scan. But the INSERT
--   policy never pins the column, so a member can simply insert a plain 'user'
--   message with `ai_scan_status = 'clear'` and the trigger returns immediately.
--   No scan, and the message is visible at once because the read policy admits
--   'clear'. This bypass needs no impersonation at all.
--
-- ═══ HOLE 3 — UPDATE is row-scoped but not column-scoped ═════════════════════
--   `messages_update_own` (007:63-66) pins `sender_user_id = auth.uid()` in both
--   USING and WITH CHECK — which row, never which column. A sender could:
--     · flip her own `ai_scan_status` to 'clear', releasing a message the
--       classifier had held as 'flagged' or routed as 'crisis' — defeating the C4
--       moderation hold from the client;
--     · rewrite `body` AFTER the scan cleared it, since the trigger fires on
--       INSERT only (scan-then-swap);
--     · flip `message_type` to 'expert' post-insert, reaching hole 1 by a
--       different door.
--
-- ═══ THE FIX ════════════════════════════════════════════════════════════════
--   INSERT: members may only ever insert a real user message, unscanned.
--   UPDATE: members may not update room messages at all.
--
--   The UPDATE policy is DROPPED rather than narrowed because no client code
--   updates this table. Verified: `apps/mobile/src/api/community.ts` touches
--   `room_messages` exactly twice — an INSERT of {room_id, sender_user_id, body}
--   at :171-173 and a SELECT of `ai_scan_status` at :246-247. There is no
--   edit-message or delete-message feature. RLS is enabled (migration 040), so
--   with no UPDATE policy every update by `authenticated` is denied; nothing is
--   granted that isn't used.
--
--   If an edit/delete-own-message feature is ever built, add a NEW policy scoped
--   to exactly the columns it needs (`is_deleted`/`deleted_at`) — and note that
--   allowing `body` edits reintroduces scan-then-swap unless the scan is re-run
--   on UPDATE.
--
-- ═══ WHAT IS NOT AFFECTED ═══════════════════════════════════════════════════
--   The legitimate producers of trusted messages all use the service-role client,
--   which bypasses RLS entirely:
--     · room-ai-companion inserts message_type='ai_companion' with
--       ai_scan_status='clear' (that is exactly why 'clear' must stay insertable
--       by service_role and not by members);
--     · room-weekly-summary inserts the message_type='system' digest card;
--     · room-message-scan PATCHes ai_scan_status after classifying.
--   None of these are `authenticated`, so none are constrained here.

begin;

-- ── INSERT: real user messages only, and always unscanned ──────────────────
drop policy if exists messages_insert_members on public.room_messages;
create policy messages_insert_members on public.room_messages for insert
  with check (
    sender_user_id = auth.uid()
    and sender_anon_id is null                    -- anon path goes through C3 edge fn
    -- Hole 1: no posting as system / ai_companion / expert.
    and message_type = 'user'
    -- Hole 2: must enter the pipeline unscanned. Anything else short-circuits
    -- scan_room_message_async()'s idempotency guard.
    and ai_scan_status = 'pending'
    and exists (
      select 1 from public.room_members rm
      where rm.room_id = room_messages.room_id and rm.user_id = auth.uid()
    )
  );

-- ── UPDATE: none for members ───────────────────────────────────────────────
-- Hole 3. RLS is on, so dropping the policy denies all updates by authenticated.
drop policy if exists messages_update_own on public.room_messages;

commit;

-- ── Verification (run after apply) ──
-- Expect: exactly one INSERT policy (with the message_type / ai_scan_status
-- clauses in its with_check) and NO UPDATE policy.
--   select policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename = 'room_messages'
--   order by cmd, policyname;
--
-- End-to-end as a room member (expect: 1 ok, 2-4 refused, 5 refused):
--   1. insert {room_id, sender_user_id: self, body}                      -> ok
--   2. insert {..., message_type: 'expert'}                              -> RLS violation
--   3. insert {..., message_type: 'ai_companion'}                        -> RLS violation
--   4. insert {..., ai_scan_status: 'clear'}                             -> RLS violation
--   5. update own row set ai_scan_status='clear'                         -> 0 rows / denied
