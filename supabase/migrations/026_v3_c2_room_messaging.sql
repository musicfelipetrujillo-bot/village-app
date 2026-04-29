-- V3 Phase C2 — Room messaging (send/list/realtime/reactions).
--
-- Scope:
--   1. Flip `room_messages.ai_scan_status` default 'pending' → 'clear'.
--      In C2 we ship without the AI scan pipeline; the Realtime filter
--      spec'd at `ai_scan_status=eq.clear` (C4 contract) would otherwise
--      drop every message forever. C4 reinstates the default + adds the
--      BEFORE-INSERT Edge Function pipeline.
--   2. `list_room_messages` RPC — joins auth.users to pull sender
--      display_name / avatar_url in one round-trip without exposing the
--      rest of the auth.users row to the client. SECURITY DEFINER; the
--      function guards on room_members membership before returning.
--   3. Add room_messages + room_message_reactions to the supabase_realtime
--      publication so mobile can subscribe to inserts.
--   4. On-insert trigger bumps the sender's own `last_read_at` so their
--      own message doesn't count as unread.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Default ai_scan_status = 'clear' (C2 placeholder — C4 replaces)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE room_messages
  ALTER COLUMN ai_scan_status SET DEFAULT 'clear';

COMMENT ON COLUMN room_messages.ai_scan_status IS
  'C2: defaults to clear (no scan pipeline yet). C4 flips default back to pending and runs Crisis Detection + Content Moderation BEFORE insert via Edge Function.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. list_room_messages — paged message feed with sender display fields.
--    SECURITY DEFINER so we can read auth.users; guards on membership first.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION list_room_messages(
  p_room_id UUID,
  p_limit   INTEGER DEFAULT 50,
  p_before  TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
  id              UUID,
  room_id         UUID,
  sender_user_id  UUID,
  sender_anon_id  UUID,
  body            TEXT,
  message_type    TEXT,
  parent_id       UUID,
  ai_scan_status  TEXT,
  created_at      TIMESTAMPTZ,
  sender_name     TEXT,
  sender_avatar_url TEXT,
  reactions       JSONB
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = p_room_id AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'not a member of this room';
  END IF;

  RETURN QUERY
    SELECT
      m.id, m.room_id, m.sender_user_id, m.sender_anon_id,
      m.body, m.message_type, m.parent_id, m.ai_scan_status, m.created_at,
      COALESCE(au.raw_user_meta_data->>'full_name',
               split_part(au.email, '@', 1)) AS sender_name,
      au.raw_user_meta_data->>'avatar_url' AS sender_avatar_url,
      COALESCE(
        (SELECT jsonb_object_agg(rx.emoji, rx.count)
           FROM (
             SELECT emoji, COUNT(*)::int AS count
             FROM room_message_reactions
             WHERE message_id = m.id
             GROUP BY emoji
           ) rx),
        '{}'::jsonb
      ) AS reactions
    FROM room_messages m
    LEFT JOIN auth.users au ON au.id = m.sender_user_id
    WHERE m.room_id = p_room_id
      AND m.is_deleted = FALSE
      AND m.ai_scan_status IN ('clear','pending')
      AND (p_before IS NULL OR m.created_at < p_before)
    ORDER BY m.created_at DESC
    LIMIT LEAST(p_limit, 100);
END;
$$;

GRANT EXECUTE ON FUNCTION list_room_messages(UUID, INTEGER, TIMESTAMPTZ) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Realtime publication — let clients subscribe to INSERTs on these tables.
-- Safe to run multiple times; ALTER PUBLICATION ... ADD TABLE errors if the
-- table is already a member, so we guard.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_message_reactions;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Self-read trigger — when a user sends a message, their own
--    last_read_at is set to that message's created_at so they don't see
--    it as unread on reopen.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bump_sender_last_read()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sender_user_id IS NOT NULL THEN
    UPDATE room_members
       SET last_read_at = NEW.created_at
     WHERE room_id = NEW.room_id
       AND user_id = NEW.sender_user_id
       AND last_read_at < NEW.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_sender_last_read ON room_messages;
CREATE TRIGGER trg_bump_sender_last_read
  AFTER INSERT ON room_messages
  FOR EACH ROW EXECUTE FUNCTION bump_sender_last_read();

-- ────────────────────────────────────────────────────────────────────────────
-- 5. mark_room_read(p_room_id) — client calls when a user opens/focuses the
--    chat screen so their last_read_at advances to now().
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_room_read(p_room_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  UPDATE room_members
     SET last_read_at = NOW()
   WHERE room_id = p_room_id
     AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION mark_room_read(UUID) TO authenticated;
