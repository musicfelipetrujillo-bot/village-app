-- V3 Community Rooms — RLS policies (Phase C1)
-- Security-critical file. `user_anonymous_identities` uses USING(FALSE) —
-- client can NEVER read the user_id → anon_alias mapping.

-- =========================================================================
-- rooms — public read for active rooms
-- =========================================================================
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rooms_public_read ON rooms;
CREATE POLICY rooms_public_read ON rooms FOR SELECT
  USING (is_active = TRUE);

-- =========================================================================
-- room_members — users manage their own membership rows
-- =========================================================================
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_members_read_self ON room_members;
CREATE POLICY room_members_read_self ON room_members FOR SELECT
  USING (user_id = auth.uid());

-- NOTE: we do not let the client INSERT/DELETE directly — use join_room/leave_room RPCs.
-- This keeps member_count accurate via trigger and gives a single choke point for
-- admission rules in the future.

-- =========================================================================
-- user_anonymous_identities — DENY ALL for authenticated clients
-- Only service role (Edge Functions) can read/write. This is a security boundary.
-- =========================================================================
ALTER TABLE user_anonymous_identities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_identity_deny_all ON user_anonymous_identities;
CREATE POLICY anon_identity_deny_all ON user_anonymous_identities
  AS RESTRICTIVE FOR ALL TO authenticated USING (FALSE) WITH CHECK (FALSE);

-- =========================================================================
-- messages — members can read cleared messages; insert in C1 goes directly
--           (write path runs AI scan BEFORE insert in C4 via Edge Function).
-- =========================================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_read_members ON room_messages;
CREATE POLICY messages_read_members ON room_messages FOR SELECT
  USING (
    is_deleted = FALSE
    AND ai_scan_status IN ('clear','pending')
    AND EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = room_messages.room_id AND rm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS messages_insert_members ON room_messages;
CREATE POLICY messages_insert_members ON room_messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND sender_anon_id IS NULL                   -- anon path uses Edge Function in C3
    AND EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = room_messages.room_id AND rm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS messages_update_own ON room_messages;
CREATE POLICY messages_update_own ON room_messages FOR UPDATE
  USING (sender_user_id = auth.uid())
  WITH CHECK (sender_user_id = auth.uid());

-- =========================================================================
-- room_message_reactions — members can add/remove their own reactions
-- =========================================================================
ALTER TABLE room_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reactions_read_members ON room_message_reactions;
CREATE POLICY reactions_read_members ON room_message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_messages m
      JOIN room_members rm ON rm.room_id = m.room_id
      WHERE m.id = room_message_reactions.message_id AND rm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS reactions_insert_own ON room_message_reactions;
CREATE POLICY reactions_insert_own ON room_message_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM room_messages m
      JOIN room_members rm ON rm.room_id = m.room_id
      WHERE m.id = room_message_reactions.message_id AND rm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS reactions_delete_own ON room_message_reactions;
CREATE POLICY reactions_delete_own ON room_message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- =========================================================================
-- room_moderators — public read (expert bubbles can be rendered anywhere)
-- =========================================================================
ALTER TABLE room_moderators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS room_moderators_read_all ON room_moderators;
CREATE POLICY room_moderators_read_all ON room_moderators FOR SELECT
  USING (is_active = TRUE);

-- =========================================================================
-- pinned_resources — public read for active resources
-- =========================================================================
ALTER TABLE pinned_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pinned_resources_public_read ON pinned_resources;
CREATE POLICY pinned_resources_public_read ON pinned_resources FOR SELECT
  USING (is_active = TRUE);

-- =========================================================================
-- crisis_flags — service role only
-- =========================================================================
ALTER TABLE crisis_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crisis_flags_deny_all ON crisis_flags;
CREATE POLICY crisis_flags_deny_all ON crisis_flags
  AS RESTRICTIVE FOR ALL TO authenticated USING (FALSE) WITH CHECK (FALSE);

-- =========================================================================
-- room_events — public read for non-cancelled events
-- =========================================================================
ALTER TABLE room_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS room_events_public_read ON room_events;
CREATE POLICY room_events_public_read ON room_events FOR SELECT
  USING (is_cancelled = FALSE);

-- =========================================================================
-- room_presence — members read each other; own row writeable
-- =========================================================================
ALTER TABLE room_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_presence_read_members ON room_presence;
CREATE POLICY room_presence_read_members ON room_presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = room_presence.room_id AND rm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS room_presence_upsert_own ON room_presence;
CREATE POLICY room_presence_upsert_own ON room_presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS room_presence_update_own ON room_presence;
CREATE POLICY room_presence_update_own ON room_presence FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS room_presence_delete_own ON room_presence;
CREATE POLICY room_presence_delete_own ON room_presence FOR DELETE
  USING (user_id = auth.uid());
