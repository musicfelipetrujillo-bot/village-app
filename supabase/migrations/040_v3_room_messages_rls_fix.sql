-- V3 Community — RLS fix for room_messages
--
-- Migration 007 line 39 contained a typo: `ALTER TABLE messages ENABLE ROW
-- LEVEL SECURITY` instead of `ALTER TABLE room_messages ENABLE ROW LEVEL
-- SECURITY`. The V1 `messages` table already had RLS enabled in migration 002,
-- so the typo was a no-op there — but it left RLS DISABLED on
-- `room_messages`, silently nullifying all four policies defined on it
-- (messages_read_members, messages_insert_members, messages_update_own, plus
-- the policies added in 027 for the C4 safety pipeline).
--
-- With RLS disabled, any authenticated user could SELECT, INSERT, UPDATE, or
-- DELETE rows in `room_messages` regardless of room membership — the policy
-- machinery was simply not consulted by the planner. The Connect tab is
-- currently hidden in `AppNavigator.tsx` per `feedback_connect_tab_hidden`,
-- so user impact at present is zero, but this gap blocks any future C-tab
-- pre-launch gate from passing.
--
-- This migration enables RLS on the table. The existing policies (last
-- modified in 027) take effect immediately:
--   - SELECT: room members only, scan-cleared messages only, not deleted
--   - INSERT: own messages, must be a member, anon path forbidden (uses
--             Edge Function service-role write instead)
--   - UPDATE: only the original sender can edit
-- Service-role writes (room-ai-companion, room-weekly-summary inserting
-- system/ai_companion messages, scan-pipeline status PATCHes) bypass RLS as
-- usual. The SECURITY DEFINER `list_room_messages` RPC also continues to work
-- as before.
--
-- Realtime subscriptions: Supabase Realtime respects RLS. With RLS now on,
-- subscribers will only receive INSERT/UPDATE events for rooms they are a
-- member of. Existing client code (`subscribeToRoomMessages`) already filters
-- on `room_id=eq.<roomId>` server-side and `ai_scan_status IN ('clear')`
-- client-side, so no client change is required — this just becomes the
-- security boundary instead of a courtesy filter.
--
-- Idempotent: the ALTER is safe to re-run (no-op when RLS is already on).

ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;

-- Verify it landed. RAISE EXCEPTION instead of NOTICE so a regression in a
-- future migration that disables RLS again will fail the reset rather than
-- silently re-introducing the gap.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'room_messages'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = TRUE
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on room_messages after migration 040';
  END IF;
END $$;
