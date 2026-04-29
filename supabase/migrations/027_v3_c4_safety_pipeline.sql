-- V3 Phase C4 — Room message AI safety pipeline (Crisis Detection + Content Moderation).
--
-- Scope:
--   1. Flip `room_messages.ai_scan_status` DEFAULT back to 'pending'
--      (C2 temporarily set it to 'clear' as a placeholder; C4 now gates messages
--      through the scan pipeline before they surface).
--   2. Fix `crisis_flags.message_id` FK — migration 006 typo pointed it at the
--      V1 `messages` (specialist messaging) table. Re-point at `room_messages`.
--   3. Update `list_room_messages` RPC — return only `ai_scan_status='clear'`
--      rows (drops the C2 pending fallthrough).
--   4. AFTER-INSERT trigger on `room_messages` that invokes the
--      `room-message-scan` Edge Function via pg_net. The edge function runs
--      Haiku crisis + moderation scans in Promise.all (3s timeout each),
--      PATCHes the row to clear/flagged/crisis, and on crisis inserts into
--      `crisis_flags` + notifies moderators by SMS.
--   5. Moderator RPCs — `list_open_crisis_flags_for_moderator`,
--      `resolve_crisis_flag`, `is_moderator_anywhere`.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Default ai_scan_status back to 'pending' (reverses C2 placeholder)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE room_messages
  ALTER COLUMN ai_scan_status SET DEFAULT 'pending';

COMMENT ON COLUMN room_messages.ai_scan_status IS
  'C4: defaults to pending. AFTER-INSERT trigger invokes room-message-scan edge function which PATCHes to clear/flagged/crisis. Realtime + list_room_messages surface only clear.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Fix crisis_flags.message_id FK — migration 006 pointed at V1 messages.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE crisis_flags DROP CONSTRAINT IF EXISTS crisis_flags_message_id_fkey;
ALTER TABLE crisis_flags
  ADD CONSTRAINT crisis_flags_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES room_messages(id) ON DELETE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. list_room_messages — filter to clear only (was clear OR pending in C2)
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS list_room_messages(UUID, INTEGER, TIMESTAMPTZ);

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
      AND m.ai_scan_status = 'clear'
      AND (p_before IS NULL OR m.created_at < p_before)
    ORDER BY m.created_at DESC
    LIMIT LEAST(p_limit, 100);
END;
$$;

GRANT EXECUTE ON FUNCTION list_room_messages(UUID, INTEGER, TIMESTAMPTZ) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. AFTER-INSERT scan trigger (async via pg_net)
--    System/ai_companion/expert message_types are trusted → marked clear inline.
--    User messages fire pg_net POST; if pg_net/settings are missing the row
--    stays 'pending' and a nightly sweep (future) can retry.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION scan_room_message_async()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.ai_scan_status <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF NEW.message_type IN ('system', 'ai_companion', 'expert') THEN
    UPDATE room_messages
       SET ai_scan_status = 'clear', ai_scan_at = NOW()
     WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/room-message-scan',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object('message_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    -- pg_net / settings missing → leave pending. Never fail the insert.
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scan_room_message ON room_messages;
CREATE TRIGGER trg_scan_room_message
  AFTER INSERT ON room_messages
  FOR EACH ROW EXECUTE FUNCTION scan_room_message_async();

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Moderator RPCs
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_moderator_anywhere()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_moderators
    WHERE user_id = auth.uid() AND is_active = TRUE
  );
$$;
GRANT EXECUTE ON FUNCTION is_moderator_anywhere() TO authenticated;

CREATE OR REPLACE FUNCTION list_open_crisis_flags_for_moderator()
RETURNS TABLE (
  id               UUID,
  message_id       UUID,
  room_id          UUID,
  room_name        TEXT,
  flagged_user_id  UUID,
  severity         TEXT,
  trigger_phrases  TEXT[],
  ai_assessment    TEXT,
  status           TEXT,
  created_at       TIMESTAMPTZ,
  message_body     TEXT,
  sender_name      TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;

  RETURN QUERY
    SELECT
      cf.id, cf.message_id, cf.room_id, r.name AS room_name,
      cf.flagged_user_id, cf.severity, cf.trigger_phrases,
      cf.ai_assessment, cf.status, cf.created_at,
      m.body AS message_body,
      COALESCE(au.raw_user_meta_data->>'full_name',
               split_part(au.email, '@', 1)) AS sender_name
    FROM crisis_flags cf
    JOIN rooms r ON r.id = cf.room_id
    JOIN room_moderators rm
      ON rm.room_id = cf.room_id
     AND rm.user_id = v_user
     AND rm.is_active = TRUE
    LEFT JOIN room_messages m ON m.id = cf.message_id
    LEFT JOIN auth.users au ON au.id = cf.flagged_user_id
    WHERE cf.status = 'open'
    ORDER BY
      CASE cf.severity
        WHEN 'critical' THEN 1
        WHEN 'high'     THEN 2
        WHEN 'medium'   THEN 3
        ELSE 4
      END,
      cf.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_open_crisis_flags_for_moderator() TO authenticated;

CREATE OR REPLACE FUNCTION resolve_crisis_flag(
  p_flag_id UUID,
  p_action  TEXT,
  p_notes   TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF p_action NOT IN ('reviewed','escalated','resolved') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  SELECT room_id INTO v_room FROM crisis_flags WHERE id = p_flag_id;
  IF v_room IS NULL THEN
    RAISE EXCEPTION 'flag not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM room_moderators
    WHERE room_id = v_room AND user_id = v_user AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not a moderator for this room';
  END IF;

  UPDATE crisis_flags
     SET status          = p_action,
         moderator_id    = v_user,
         moderator_notes = COALESCE(p_notes, moderator_notes),
         resolved_at     = CASE WHEN p_action = 'resolved' THEN NOW() ELSE resolved_at END
   WHERE id = p_flag_id;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_crisis_flag(UUID, TEXT, TEXT) TO authenticated;
