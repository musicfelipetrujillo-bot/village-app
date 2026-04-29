-- ─────────────────────────────────────────────────────────────
-- 019_v2_m4_messaging_reviews.sql
-- V2 Milk Connect — Phase M4 (messaging threads + reviews)
--
-- Adds:
--   • Thread last_message_at update trigger (when message inserted)
--   • Indexes for thread/message ordering
--   • Optional thread.unread_count via aggregate view (computed in RPC)
--   • RPC: list_my_milk_threads — returns threads with last message + unread count
--   • RPC: get_thread_messages — paginated message reads (DESC by sent_at)
--   • Reviewable transactions RPC (returns paid orders without a review)
-- ─────────────────────────────────────────────────────────────

-- 1. Thread metadata indexes
CREATE INDEX IF NOT EXISTS idx_milk_messages_thread_sent
  ON milk_messages (thread_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_milk_threads_recipient_last
  ON milk_message_threads (recipient_user_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_milk_threads_donor_last
  ON milk_message_threads (donor_profile_id, last_message_at DESC);

-- 2. Trigger: when a message is inserted, bump thread.last_message_at
CREATE OR REPLACE FUNCTION bump_thread_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE milk_message_threads
     SET last_message_at = NEW.sent_at
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_thread_last_message ON milk_messages;
CREATE TRIGGER trg_bump_thread_last_message
  AFTER INSERT ON milk_messages
  FOR EACH ROW EXECUTE FUNCTION bump_thread_last_message();

-- 3. RPC: thread inbox for a user (works for both recipient + donor sides)
CREATE OR REPLACE FUNCTION list_my_milk_threads(p_user_id UUID)
RETURNS TABLE (
  thread_id           UUID,
  donor_profile_id    UUID,
  recipient_user_id   UUID,
  other_display_name  TEXT,
  other_avatar_url    TEXT,
  last_message_body   TEXT,
  last_message_at     TIMESTAMPTZ,
  unread_count        INTEGER,
  is_donor_side       BOOLEAN
) LANGUAGE sql STABLE AS $$
  WITH my_donor AS (
    SELECT id FROM milk_donor_profiles WHERE user_id = p_user_id
  ),
  my_threads AS (
    SELECT t.*,
      (t.donor_profile_id IN (SELECT id FROM my_donor)) AS is_donor_side
    FROM milk_message_threads t
    WHERE t.recipient_user_id = p_user_id
       OR t.donor_profile_id IN (SELECT id FROM my_donor)
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.thread_id)
      m.thread_id, m.body, m.sent_at
    FROM milk_messages m
    WHERE m.thread_id IN (SELECT id FROM my_threads)
    ORDER BY m.thread_id, m.sent_at DESC
  ),
  unread AS (
    SELECT m.thread_id, COUNT(*)::INT AS unread_count
    FROM milk_messages m
    WHERE m.thread_id IN (SELECT id FROM my_threads)
      AND m.is_read = FALSE
      AND m.sender_id <> p_user_id
    GROUP BY m.thread_id
  )
  SELECT
    t.id AS thread_id,
    t.donor_profile_id,
    t.recipient_user_id,
    CASE
      WHEN t.is_donor_side THEN
        COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = t.recipient_user_id), 'Recipient')
      ELSE
        (SELECT display_name FROM milk_donor_profiles WHERE id = t.donor_profile_id)
    END AS other_display_name,
    CASE
      WHEN t.is_donor_side THEN NULL
      ELSE (SELECT avatar_url FROM milk_donor_profiles WHERE id = t.donor_profile_id)
    END AS other_avatar_url,
    lm.body AS last_message_body,
    COALESCE(lm.sent_at, t.last_message_at) AS last_message_at,
    COALESCE(u.unread_count, 0) AS unread_count,
    t.is_donor_side
  FROM my_threads t
  LEFT JOIN last_msg lm ON lm.thread_id = t.id
  LEFT JOIN unread u    ON u.thread_id  = t.id
  ORDER BY COALESCE(lm.sent_at, t.last_message_at) DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION list_my_milk_threads(UUID) TO authenticated;

-- 4. RPC: mark all messages in a thread as read for the calling user
CREATE OR REPLACE FUNCTION mark_thread_read(p_thread_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- caller must be a participant
  IF NOT EXISTS (
    SELECT 1 FROM milk_message_threads t
    WHERE t.id = p_thread_id
      AND (t.recipient_user_id = auth.uid()
        OR t.donor_profile_id IN (SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE milk_messages
     SET is_read = TRUE
   WHERE thread_id = p_thread_id
     AND sender_id <> auth.uid()
     AND is_read = FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_thread_read(UUID) TO authenticated;

-- 5. RPC: list reviewable transactions (paid/fulfilled with no review)
CREATE OR REPLACE FUNCTION list_reviewable_orders(p_user_id UUID)
RETURNS TABLE (
  transaction_id      UUID,
  donor_profile_id    UUID,
  donor_display_name  TEXT,
  donor_avatar_url    TEXT,
  oz_purchased        INTEGER,
  created_at          TIMESTAMPTZ
) LANGUAGE sql STABLE AS $$
  SELECT t.id, t.donor_profile_id, p.display_name, p.avatar_url, t.oz_purchased, t.created_at
  FROM milk_transactions t
  JOIN milk_donor_profiles p ON p.id = t.donor_profile_id
  WHERE t.recipient_user_id = p_user_id
    AND t.status IN ('paid','fulfilled')
    AND NOT EXISTS (SELECT 1 FROM milk_reviews r WHERE r.transaction_id = t.id)
  ORDER BY t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION list_reviewable_orders(UUID) TO authenticated;
