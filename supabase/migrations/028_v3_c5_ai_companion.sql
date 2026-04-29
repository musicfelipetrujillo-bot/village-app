-- V3 Phase C5 — AI Companion (@village), icebreakers, auto-match, weekly summaries.
--
-- Scope:
--   1. icebreaker_suggestions — cached first-message prompt shown to a new
--      member in the composer (Haiku 0.8). One row per (user, room). Generated
--      async after join; never auto-sent.
--   2. room_match_suggestions — AI-ranked rooms for a user (Haiku 0.2), keyed
--      on (user_id, pregnancy_stage|current_week). Refreshed on profile
--      updates; surfaces in CommunityHomeScreen as "Suggested for you".
--   3. room_weekly_summaries — anonymized 3–4 sentence digest of the last 7
--      days in a room (Sonnet batch). Rendered as a system card in-room +
--      pushed to members via OneSignal.
--   4. Companion mention log — a LEFT JOIN-friendly table that tracks
--      @village invocations so we can rate-limit and audit. Kept tiny.
--   5. Policy shift on room_messages: allow service_role to INSERT
--      ai_companion/system rows (the @village reply + weekly summary card).
--      Existing RLS policy messages_insert_members stays unchanged for users.
--   6. pg_cron job `room-weekly-summaries-sunday` — Sunday 06:00 ET.
--
-- Safety posture:
--   - AI companion replies still traverse the C4 scan pipeline: the
--     AFTER-INSERT trigger from migration 027 marks ai_companion rows 'clear'
--     inline (trusted message_type), so they surface immediately without
--     re-scanning Village's own copy.
--   - Crisis detection in @village flow: if the USER's @village-mention
--     message trips the C4 crisis classifier, the companion reply is
--     suppressed — the message itself is already removed and
--     CrisisResourcesSheet fires. The companion never competes with crisis
--     routing.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Icebreaker suggestions — per (user, room) first-message prompt
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS icebreaker_suggestions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id        UUID NOT NULL REFERENCES rooms(id)       ON DELETE CASCADE,
  suggestion     TEXT NOT NULL CHECK (char_length(suggestion) BETWEEN 1 AND 280),
  used_at        TIMESTAMPTZ,
  dismissed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, room_id)
);
CREATE INDEX IF NOT EXISTS idx_icebreakers_user_room
  ON icebreaker_suggestions(user_id, room_id);

ALTER TABLE icebreaker_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS icebreakers_own_read ON icebreaker_suggestions;
CREATE POLICY icebreakers_own_read ON icebreaker_suggestions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS icebreakers_own_update ON icebreaker_suggestions;
CREATE POLICY icebreakers_own_update ON icebreaker_suggestions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role (edge function) writes via bypass; no INSERT policy needed.

-- Fetch the current icebreaker for a room (or NULL if none / dismissed / used).
CREATE OR REPLACE FUNCTION get_icebreaker(p_room_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT suggestion FROM icebreaker_suggestions
   WHERE user_id = auth.uid()
     AND room_id = p_room_id
     AND used_at IS NULL
     AND dismissed_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION get_icebreaker(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION dismiss_icebreaker(p_room_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  UPDATE icebreaker_suggestions
     SET dismissed_at = NOW()
   WHERE user_id = auth.uid()
     AND room_id = p_room_id
     AND dismissed_at IS NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION dismiss_icebreaker(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Room match suggestions — AI-ranked rooms for each user
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_match_suggestions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_room_id   UUID REFERENCES rooms(id) ON DELETE SET NULL,
  secondary_room_ids UUID[] NOT NULL DEFAULT '{}',
  reason         TEXT CHECK (char_length(reason) <= 400),
  generator_version TEXT NOT NULL DEFAULT 'haiku-4.5-v1',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE room_match_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_match_own_read ON room_match_suggestions;
CREATE POLICY room_match_own_read ON room_match_suggestions
  FOR SELECT USING (user_id = auth.uid());

-- Service role writes; no insert policy for authenticated users.

-- Convenience RPC: returns the user's current match as hydrated room rows.
CREATE OR REPLACE FUNCTION get_my_room_match()
RETURNS TABLE (
  primary_room   JSONB,
  secondary_rooms JSONB,
  reason         TEXT,
  created_at     TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;

  RETURN QUERY
  SELECT
    (SELECT to_jsonb(r.*) FROM rooms r WHERE r.id = s.primary_room_id AND r.is_active),
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(r2.*))
         FROM rooms r2
        WHERE r2.id = ANY(s.secondary_room_ids) AND r2.is_active),
      '[]'::jsonb),
    s.reason,
    s.created_at
  FROM room_match_suggestions s
  WHERE s.user_id = v_user
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION get_my_room_match() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Weekly room summaries (Sonnet batch)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_weekly_summaries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  period_start   TIMESTAMPTZ NOT NULL,
  period_end     TIMESTAMPTZ NOT NULL,
  summary        TEXT NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 800),
  message_count  INTEGER NOT NULL DEFAULT 0,
  generator_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  pushed_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_room
  ON room_weekly_summaries(room_id, period_end DESC);

ALTER TABLE room_weekly_summaries ENABLE ROW LEVEL SECURITY;

-- Any authenticated member of the room can read the summary.
DROP POLICY IF EXISTS weekly_summary_read_members ON room_weekly_summaries;
CREATE POLICY weekly_summary_read_members ON room_weekly_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = room_weekly_summaries.room_id AND user_id = auth.uid()
    )
  );

-- Service role writes.

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Companion mention log (rate limiting + audit)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_companion_mentions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id        UUID NOT NULL REFERENCES rooms(id)       ON DELETE CASCADE,
  trigger_message_id UUID REFERENCES room_messages(id)    ON DELETE SET NULL,
  reply_message_id   UUID REFERENCES room_messages(id)    ON DELETE SET NULL,
  crisis_detected BOOLEAN NOT NULL DEFAULT FALSE,
  suppressed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_companion_mentions_user_time
  ON ai_companion_mentions(user_id, created_at DESC);

ALTER TABLE ai_companion_mentions ENABLE ROW LEVEL SECURITY;
-- Own-read only; service-role writes.
DROP POLICY IF EXISTS companion_mentions_own_read ON ai_companion_mentions;
CREATE POLICY companion_mentions_own_read ON ai_companion_mentions
  FOR SELECT USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Helper: detect @village mention in a message (public, stable).
-- Anchored word-boundary match — doesn't fire on 'villager', email, URL.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION has_village_mention(p_body TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT p_body ~* '(^|[^a-z0-9_])@village($|[^a-z0-9_])';
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Weekly summary cron — Sunday 06:00 ET (11:00 UTC)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'room-weekly-summaries-sunday') THEN
      PERFORM cron.unschedule('room-weekly-summaries-sunday');
    END IF;
    PERFORM cron.schedule(
      'room-weekly-summaries-sunday',
      '0 11 * * 0',
      $cron$
      SELECT net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/room-weekly-summary',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body    := '{"mode":"batch"}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;
