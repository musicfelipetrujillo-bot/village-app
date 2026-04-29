-- V3 Community Rooms — schema (Phase C1)
-- Tables: rooms, room_members, user_anonymous_identities, messages, room_message_reactions,
--         room_moderators, pinned_resources, crisis_flags, room_events, room_presence
-- RLS in 007. Seed in 003_v1_seed_data is specialist-only; V3 seed at the bottom of this file.

-- =========================================================================
-- 1. rooms
-- =========================================================================
CREATE TABLE IF NOT EXISTS rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  emoji           TEXT NOT NULL DEFAULT '💬',
  description     TEXT NOT NULL,
  room_type       TEXT NOT NULL CHECK (room_type IN ('stage_local','topic','support')),
  color_theme     TEXT NOT NULL DEFAULT 'rust'
                    CHECK (color_theme IN ('rust','olive','brown','cream')),
  city            TEXT,                            -- NULL = global
  stage_week_min  SMALLINT,
  stage_week_max  SMALLINT,
  anonymous_mode  TEXT NOT NULL DEFAULT 'optional'
                    CHECK (anonymous_mode IN ('none','optional','mandatory')),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  member_count    INTEGER NOT NULL DEFAULT 0,       -- denormalized via trigger
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rooms_active_type ON rooms(room_type, is_active);
CREATE INDEX IF NOT EXISTS idx_rooms_city         ON rooms(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_stage        ON rooms(stage_week_min, stage_week_max)
  WHERE stage_week_min IS NOT NULL;

-- =========================================================================
-- 2. room_members
-- =========================================================================
CREATE TABLE IF NOT EXISTS room_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_muted       BOOLEAN NOT NULL DEFAULT FALSE,
  notif_pref     TEXT NOT NULL DEFAULT 'mentions'
                   CHECK (notif_pref IN ('all','mentions','none')),
  UNIQUE (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);

-- =========================================================================
-- 3. user_anonymous_identities  — SAFETY-CRITICAL (service-role only)
-- =========================================================================
CREATE TABLE IF NOT EXISTS user_anonymous_identities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anon_alias       TEXT NOT NULL,
  anon_avatar_seed TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id),
  UNIQUE (room_id, anon_alias)
);

-- =========================================================================
-- 4. room_messages  (distinct from V1 `messages` (specialist DMs) and V2 `milk_messages`)
-- =========================================================================
CREATE TABLE IF NOT EXISTS room_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_anon_id  UUID REFERENCES user_anonymous_identities(id) ON DELETE SET NULL,
  CONSTRAINT chk_sender_exclusive CHECK (
    (sender_user_id IS NOT NULL AND sender_anon_id IS NULL) OR
    (sender_user_id IS NULL AND sender_anon_id IS NOT NULL) OR
    (sender_user_id IS NULL AND sender_anon_id IS NULL)  -- system / AI messages
  ),
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  message_type    TEXT NOT NULL DEFAULT 'user'
                    CHECK (message_type IN ('user','system','ai_companion','expert')),
  parent_id       UUID REFERENCES room_messages(id) ON DELETE SET NULL,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_scan_status  TEXT NOT NULL DEFAULT 'pending'
                    CHECK (ai_scan_status IN ('pending','clear','flagged','crisis')),
  ai_scan_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_room_messages_feed
  ON room_messages(room_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_room_messages_crisis
  ON room_messages(room_id, created_at DESC) WHERE ai_scan_status = 'crisis';

-- =========================================================================
-- 5. room_message_reactions
-- =========================================================================
CREATE TABLE IF NOT EXISTS room_message_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES room_messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL CHECK (emoji IN ('❤️','🤗','💪','😂','😢','🙏')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON room_message_reactions(message_id);

-- =========================================================================
-- 6. room_moderators
-- =========================================================================
CREATE TABLE IF NOT EXISTS room_moderators (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id                 UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                    TEXT NOT NULL DEFAULT 'moderator'
                            CHECK (role IN ('moderator','lead_moderator','expert')),
  credential_label        TEXT,
  calendly_event_type_uri TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (room_id, user_id)
);

-- =========================================================================
-- 7. pinned_resources
-- =========================================================================
CREATE TABLE IF NOT EXISTS pinned_resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  resource_type TEXT NOT NULL
                  CHECK (resource_type IN ('crisis_hotline','article','booking_link','event')),
  url           TEXT,
  phone_number  TEXT,
  display_order SMALLINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_pinned_room
  ON pinned_resources(room_id, display_order) WHERE is_active = TRUE;

-- =========================================================================
-- 8. crisis_flags
-- =========================================================================
CREATE TABLE IF NOT EXISTS crisis_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  room_id           UUID NOT NULL REFERENCES rooms(id),
  flagged_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  trigger_phrases   TEXT[],
  ai_assessment     TEXT,
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','reviewed','escalated','resolved')),
  moderator_id      UUID REFERENCES auth.users(id),
  moderator_notes   TEXT,
  sms_sent          BOOLEAN NOT NULL DEFAULT FALSE,
  sms_sent_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_crisis_open
  ON crisis_flags(severity, created_at DESC) WHERE status = 'open';

-- =========================================================================
-- 9. room_events
-- =========================================================================
CREATE TABLE IF NOT EXISTS room_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  moderator_id        UUID NOT NULL REFERENCES room_moderators(id),
  title               TEXT NOT NULL,
  description         TEXT,
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  calendly_event_uri  TEXT,
  rsvp_count          INTEGER NOT NULL DEFAULT 0,
  is_cancelled        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_room_upcoming
  ON room_events(room_id, starts_at) WHERE is_cancelled = FALSE;

-- =========================================================================
-- 10. room_presence
-- =========================================================================
CREATE TABLE IF NOT EXISTS room_presence (
  room_id        UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- =========================================================================
-- TRIGGER: member_count denormalization on rooms
-- =========================================================================
CREATE OR REPLACE FUNCTION bump_room_member_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE rooms SET member_count = member_count + 1 WHERE id = NEW.room_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE rooms SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.room_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_room_member_count ON room_members;
CREATE TRIGGER trg_bump_room_member_count
  AFTER INSERT OR DELETE ON room_members
  FOR EACH ROW EXECUTE FUNCTION bump_room_member_count();

-- =========================================================================
-- RPC: list_rooms_for_discovery
-- Returns rooms ranked by stage-match score for the caller's profile.
-- Stage-match score: 10 if room's stage window contains user's current week, else 0.
-- Uses users.due_date to compute current pregnancy week.
-- =========================================================================
CREATE OR REPLACE FUNCTION list_rooms_for_discovery(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,
  emoji           TEXT,
  description     TEXT,
  room_type       TEXT,
  color_theme     TEXT,
  city            TEXT,
  stage_week_min  SMALLINT,
  stage_week_max  SMALLINT,
  anonymous_mode  TEXT,
  member_count    INTEGER,
  is_member       BOOLEAN,
  stage_match_score INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_due_date DATE;
  v_current_week INT;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT due_date INTO v_due_date FROM users WHERE id = p_user_id;
    IF v_due_date IS NOT NULL THEN
      -- Gestational age at today = 40 - weeks-until-due
      v_current_week := GREATEST(0, 40 - EXTRACT(WEEK FROM (v_due_date - CURRENT_DATE))::INT);
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.slug, r.name, r.emoji, r.description, r.room_type, r.color_theme,
    r.city, r.stage_week_min, r.stage_week_max, r.anonymous_mode, r.member_count,
    EXISTS(SELECT 1 FROM room_members rm WHERE rm.room_id = r.id AND rm.user_id = p_user_id) AS is_member,
    CASE
      WHEN v_current_week IS NULL THEN 0
      WHEN r.stage_week_min IS NULL OR r.stage_week_max IS NULL THEN 0
      WHEN v_current_week BETWEEN r.stage_week_min AND r.stage_week_max THEN 10
      ELSE 0
    END::INT AS stage_match_score
  FROM rooms r
  WHERE r.is_active = TRUE
  ORDER BY stage_match_score DESC, r.member_count DESC, r.created_at DESC;
END;
$$;

-- =========================================================================
-- RPC: join_room / leave_room
-- =========================================================================
CREATE OR REPLACE FUNCTION join_room(p_room_id UUID)
RETURNS room_members LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row room_members;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO room_members (room_id, user_id)
  VALUES (p_room_id, auth.uid())
  ON CONFLICT (room_id, user_id) DO UPDATE SET joined_at = room_members.joined_at
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION leave_room(p_room_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM room_members WHERE room_id = p_room_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION list_rooms_for_discovery(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION join_room(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION leave_room(UUID) TO authenticated;

-- =========================================================================
-- SEED DATA — 4 starter rooms (per C1 plan) + crisis resources for PPD room
-- =========================================================================
INSERT INTO rooms (slug, name, emoji, description, room_type, color_theme, city, stage_week_min, stage_week_max, anonymous_mode)
VALUES
  ('miami-moms-trimester-3',   'Miami Moms · 3rd Trimester', '🤰', 'Expecting in Miami and in your final stretch. Birth plans, hospital tips, last-minute gear.', 'stage_local', 'rust',  'Miami', 28, 40, 'none'),
  ('newborn-nights',           'Newborn Nights',             '🌙', 'Up at 3am? You''re not alone. Peer support for the first 12 weeks.',                        'topic',       'olive', NULL,     0,  12, 'optional'),
  ('breastfeeding-struggles',  'Breastfeeding Struggles',    '🤱', 'Latch, supply, pumping, weaning — no judgment.',                                          'topic',       'brown', NULL,    NULL, NULL, 'optional'),
  ('ppd-anxiety-support',      'PPD / Anxiety Support',      '💛', 'A soft space for moms navigating postpartum depression or anxiety. Moderated by clinicians.', 'support',   'cream', NULL,    NULL, NULL, 'mandatory')
ON CONFLICT (slug) DO NOTHING;

-- Pin crisis resources on PPD room
INSERT INTO pinned_resources (room_id, title, resource_type, url, phone_number, display_order)
SELECT r.id, x.title, x.resource_type, x.url, x.phone_number, x.display_order
FROM rooms r
CROSS JOIN (VALUES
  ('988 Suicide & Crisis Lifeline',       'crisis_hotline', NULL,                       '988',        1),
  ('Postpartum Support International',    'crisis_hotline', NULL,                       '18009444773',2),
  ('Crisis Text Line — text HOME to 741741','crisis_hotline', 'sms:741741?body=HOME',     '741741',     3)
) AS x(title, resource_type, url, phone_number, display_order)
WHERE r.slug = 'ppd-anxiety-support'
ON CONFLICT DO NOTHING;
