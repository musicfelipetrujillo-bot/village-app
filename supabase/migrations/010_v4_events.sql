-- V4 Phase G2 — Events + RSVP
-- Spec: docs/source/Village_Feature_Specs.md § Spec 3 (Events & Community)
-- Scope v1: Miami-Dade only, in-person + external virtual links only, free only, service-role curated.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ────────────────────────────────────────────────────────────────────────────
-- events
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('local', 'webinar')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_image_url TEXT,

  -- Host
  host_name TEXT NOT NULL,
  host_avatar_url TEXT,
  is_partner BOOLEAN NOT NULL DEFAULT FALSE,         -- curated launch partner (e.g. Baby Trails)
  is_third_party BOOLEAN NOT NULL DEFAULT FALSE,     -- external org → show disclaimer

  -- When
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',

  -- Who
  capacity INTEGER,                                   -- NULL = unlimited
  age_tags TEXT[] NOT NULL DEFAULT '{}',              -- {'pregnancy','0-3mo','3-6mo','6-12mo','12mo+'}

  -- Where — local
  venue_name TEXT,
  address TEXT,
  city TEXT,
  location GEOGRAPHY(Point, 4326),

  -- Where — webinar
  stream_url TEXT,
  platform TEXT CHECK (platform IN ('zoom','youtube','teams','other')),

  -- Cost (paid ticketing deferred per spec — stub fields for forward-compat)
  is_free BOOLEAN NOT NULL DEFAULT TRUE,
  price_cents INTEGER,

  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming','live','ended','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT local_has_location CHECK (
    type <> 'local' OR (venue_name IS NOT NULL AND location IS NOT NULL)
  ),
  CONSTRAINT webinar_has_url CHECK (
    type <> 'webinar' OR stream_url IS NOT NULL
  )
);

CREATE INDEX idx_events_starts_at ON events(starts_at);
CREATE INDEX idx_events_status    ON events(status);
CREATE INDEX idx_events_type      ON events(type);
CREATE INDEX idx_events_location  ON events USING GIST(location);
CREATE INDEX idx_events_age_tags  ON events USING GIN(age_tags);

CREATE OR REPLACE FUNCTION touch_events_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION touch_events_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- event_rsvps
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going'
    CHECK (status IN ('going','waitlist','cancelled')),
  added_to_calendar BOOLEAN NOT NULL DEFAULT FALSE,
  calendar_event_id TEXT,                           -- native device calendar id (for later removal)
  rsvpd_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  UNIQUE (user_id, event_id)
);
CREATE INDEX idx_rsvps_user  ON event_rsvps(user_id);
CREATE INDEX idx_rsvps_event ON event_rsvps(event_id);

-- Auto-waitlist trigger — clamp to capacity
CREATE OR REPLACE FUNCTION enforce_event_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_capacity INTEGER;
  v_going_count INTEGER;
BEGIN
  IF NEW.status <> 'going' THEN RETURN NEW; END IF;

  SELECT capacity INTO v_capacity FROM events WHERE id = NEW.event_id;
  IF v_capacity IS NULL THEN RETURN NEW; END IF;  -- unlimited

  SELECT COUNT(*) INTO v_going_count
    FROM event_rsvps
    WHERE event_id = NEW.event_id AND status = 'going' AND id <> NEW.id;

  IF v_going_count >= v_capacity THEN
    NEW.status := 'waitlist';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_event_capacity
  BEFORE INSERT OR UPDATE ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION enforce_event_capacity();

-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps  ENABLE ROW LEVEL SECURITY;

-- Events: public read of non-cancelled events; service-role writes.
CREATE POLICY "events_public_read" ON events
  FOR SELECT USING (status IN ('upcoming','live','ended'));
CREATE POLICY "events_service_write" ON events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RSVPs: own only.
CREATE POLICY "rsvps_own_read" ON event_rsvps
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "rsvps_own_insert" ON event_rsvps
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "rsvps_own_update" ON event_rsvps
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: list_events_near — proximity + type + age filter
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION list_events_near(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 50,
  p_type TEXT DEFAULT NULL,
  p_age_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID, type TEXT, title TEXT, description TEXT,
  cover_image_url TEXT, host_name TEXT, host_avatar_url TEXT,
  is_partner BOOLEAN, is_third_party BOOLEAN,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, timezone TEXT,
  capacity INTEGER, age_tags TEXT[],
  venue_name TEXT, address TEXT, city TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION, distance_km DOUBLE PRECISION,
  stream_url TEXT, platform TEXT,
  is_free BOOLEAN, price_cents INTEGER, status TEXT,
  going_count INTEGER
) LANGUAGE sql STABLE AS $$
  SELECT
    e.id, e.type, e.title, e.description,
    e.cover_image_url, e.host_name, e.host_avatar_url,
    e.is_partner, e.is_third_party,
    e.starts_at, e.ends_at, e.timezone,
    e.capacity, e.age_tags,
    e.venue_name, e.address, e.city,
    CASE WHEN e.location IS NOT NULL THEN ST_Y(e.location::geometry) END AS lat,
    CASE WHEN e.location IS NOT NULL THEN ST_X(e.location::geometry) END AS lng,
    CASE
      WHEN e.location IS NOT NULL AND p_lat IS NOT NULL AND p_lng IS NOT NULL
      THEN ST_Distance(e.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000.0
    END AS distance_km,
    e.stream_url, e.platform,
    e.is_free, e.price_cents, e.status,
    (SELECT COUNT(*)::INTEGER FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going')
  FROM events e
  WHERE e.status IN ('upcoming', 'live')
    AND e.ends_at > now()
    AND (p_type IS NULL OR e.type = p_type)
    AND (p_age_tags IS NULL OR e.age_tags && p_age_tags)
    AND (
      e.type = 'webinar'
      OR p_lat IS NULL OR p_lng IS NULL
      OR ST_DWithin(e.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000)
    )
  ORDER BY
    CASE
      WHEN e.type = 'local' AND p_lat IS NOT NULL AND p_lng IS NOT NULL
      THEN ST_Distance(e.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
      ELSE 0
    END,
    e.starts_at;
$$;

GRANT EXECUTE ON FUNCTION list_events_near TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: list_my_rsvps — upcoming or past
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION list_my_rsvps(p_past BOOLEAN DEFAULT FALSE)
RETURNS TABLE (
  rsvp_id UUID, rsvp_status TEXT, added_to_calendar BOOLEAN, rsvpd_at TIMESTAMPTZ,
  event_id UUID, type TEXT, title TEXT, cover_image_url TEXT, host_name TEXT,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, timezone TEXT,
  venue_name TEXT, address TEXT, city TEXT, stream_url TEXT, platform TEXT,
  event_status TEXT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    r.id, r.status, r.added_to_calendar, r.rsvpd_at,
    e.id, e.type, e.title, e.cover_image_url, e.host_name,
    e.starts_at, e.ends_at, e.timezone,
    e.venue_name, e.address, e.city, e.stream_url, e.platform,
    e.status
  FROM event_rsvps r
  JOIN events e ON e.id = r.event_id
  WHERE r.user_id = auth.uid()
    AND r.status IN ('going','waitlist')
    AND (
      (p_past = FALSE AND e.ends_at > now())
      OR (p_past = TRUE AND e.ends_at <= now())
    )
  ORDER BY e.starts_at;
$$;

GRANT EXECUTE ON FUNCTION list_my_rsvps TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Seed: 4 sample events (2 local Miami, 2 webinars)
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO events (
  type, title, description, host_name, is_partner,
  starts_at, ends_at, timezone, capacity, age_tags,
  venue_name, address, city, location
) VALUES
  ('local',
   'Baby Trails Sensory Play — Brickell',
   'Sensory mats, bubbles, and live lullaby music for babies 0–12 months. Bring a blanket. Indoor, A/C.',
   'Baby Trails Miami', TRUE,
   now() + interval '3 days' + interval '10 hours',
   now() + interval '3 days' + interval '11 hours 30 minutes',
   'America/New_York', 30,
   ARRAY['0-3mo','3-6mo','6-12mo'],
   'Simpson Park Hammock', '55 SW 17th Rd', 'Miami',
   ST_SetSRID(ST_MakePoint(-80.1918, 25.7617), 4326)::geography),
  ('local',
   'Stroller Walk + Coffee — Coconut Grove',
   'Relaxed 45-min loop through the Grove. Meet other moms and babies. Free coffee after.',
   'The Village Community', TRUE,
   now() + interval '5 days' + interval '9 hours',
   now() + interval '5 days' + interval '10 hours 30 minutes',
   'America/New_York', NULL,
   ARRAY['0-3mo','3-6mo','6-12mo','12mo+'],
   'Kennedy Park', '2400 S Bayshore Dr', 'Miami',
   ST_SetSRID(ST_MakePoint(-80.2434, 25.7282), 4326)::geography);

INSERT INTO events (
  type, title, description, host_name, is_third_party,
  starts_at, ends_at, timezone, age_tags, stream_url, platform
) VALUES
  ('webinar',
   'Starting Solids: What I Wish I Knew',
   'Live Q&A with a registered pediatric dietitian. BLW vs purees, iron, allergens, gagging vs choking.',
   'Dr. Lila Ortega, RD', TRUE,
   now() + interval '2 days' + interval '20 hours',
   now() + interval '2 days' + interval '21 hours',
   'America/New_York',
   ARRAY['3-6mo','6-12mo'],
   'https://zoom.us/j/example-starting-solids', 'zoom'),
  ('webinar',
   'Infant Sleep — Biology, Not Training',
   'A sleep researcher walks through normal infant sleep development. Evidence over "methods."',
   'Dr. Renee Chaffin, PhD', TRUE,
   now() + interval '7 days' + interval '19 hours',
   now() + interval '7 days' + interval '20 hours',
   'America/New_York',
   ARRAY['pregnancy','0-3mo','3-6mo'],
   'https://youtu.be/example-infant-sleep', 'youtube');
