-- V4 G2 — Fix-up: needs_geocode flag for ICS-ingested events.
--
-- Bug: migration 046's `upsert_ingested_event` writes a (0,0) Null-Island
-- sentinel to events.location for ICS rows that arrive with text-only
-- LOCATION (no coords) — the sentinel satisfies the local_has_location
-- CHECK constraint so the row can land in 'pending' until events-geocode
-- resolves the address.
--
-- The events-geocode edge function filtered with `is('location', null)`
-- and an early-return on `data.location` in event-mode, so it never
-- detected the sentinel rows. Result: ICS events stayed at (0,0) forever.
--
-- Fix: add a boolean column `needs_geocode` flipped TRUE on sentinel
-- inserts and FALSE when set_event_location resolves real coords. The
-- edge function filters on this flag, so the (0,0) detail is opaque.
--
-- Idempotent: re-running this migration is safe.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS needs_geocode BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_events_needs_geocode
  ON events(needs_geocode)
  WHERE needs_geocode = TRUE;

-- Backfill: any existing local-type pending events sitting at the Null-
-- Island sentinel get flipped to needs_geocode=TRUE so the next sweep
-- catches them. Use a tight bounding box (±0.001°) instead of equality
-- because round-tripping through PostGIS can introduce float jitter.
UPDATE events
   SET needs_geocode = TRUE
 WHERE type = 'local'
   AND location IS NOT NULL
   AND ABS(ST_Y(location::geometry)) < 0.001
   AND ABS(ST_X(location::geometry)) < 0.001
   AND needs_geocode = FALSE;

-- ────────────────────────────────────────────────────────────────────────────
-- Replace upsert_ingested_event to set the flag on sentinel inserts.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_ingested_event(
  p_source_feed_id UUID,
  p_source_uid TEXT,
  p_type TEXT,
  p_title TEXT,
  p_description TEXT,
  p_host_name TEXT,
  p_host_avatar_url TEXT,
  p_is_partner BOOLEAN,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_timezone TEXT,
  p_age_tags TEXT[],
  p_venue_name TEXT,
  p_address TEXT,
  p_city TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_stream_url TEXT,
  p_platform TEXT
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
  v_geo GEOGRAPHY(Point, 4326);
  v_needs_geocode BOOLEAN := FALSE;
BEGIN
  IF p_type = 'local' THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      -- Null-Island sentinel until events-geocode resolves the address.
      -- needs_geocode=TRUE so the sweep picks it up.
      v_geo := ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography;
      v_needs_geocode := TRUE;
    ELSE
      v_geo := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
    END IF;
  END IF;

  INSERT INTO events (
    type, title, description, host_name, host_avatar_url,
    is_partner, is_third_party,
    starts_at, ends_at, timezone, age_tags,
    venue_name, address, city, location, needs_geocode,
    stream_url, platform,
    is_free, status, review_status,
    source_feed_id, source_uid, source_synced_at
  ) VALUES (
    p_type, p_title, p_description, p_host_name, p_host_avatar_url,
    p_is_partner, TRUE,
    p_starts_at, p_ends_at, p_timezone, COALESCE(p_age_tags, '{}'),
    p_venue_name, p_address, p_city, v_geo, v_needs_geocode,
    p_stream_url, p_platform,
    TRUE, 'upcoming', 'pending',
    p_source_feed_id, p_source_uid, now()
  )
  ON CONFLICT (source_feed_id, source_uid)
  WHERE source_feed_id IS NOT NULL AND source_uid IS NOT NULL
  DO UPDATE SET
    type             = EXCLUDED.type,
    title            = EXCLUDED.title,
    description      = EXCLUDED.description,
    host_name        = EXCLUDED.host_name,
    host_avatar_url  = EXCLUDED.host_avatar_url,
    is_partner       = EXCLUDED.is_partner,
    starts_at        = EXCLUDED.starts_at,
    ends_at          = EXCLUDED.ends_at,
    timezone         = EXCLUDED.timezone,
    -- Don't clobber location, age_tags, or needs_geocode on update —
    -- they may have been improved by events-geocode / ai-event-screen.
    venue_name       = EXCLUDED.venue_name,
    address          = EXCLUDED.address,
    city             = COALESCE(events.city, EXCLUDED.city),
    stream_url       = EXCLUDED.stream_url,
    platform         = EXCLUDED.platform,
    source_synced_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_ingested_event FROM PUBLIC;

-- ────────────────────────────────────────────────────────────────────────────
-- Replace set_event_location to clear the flag on resolution.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_event_location(
  p_event_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE events
     SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
         needs_geocode = FALSE
   WHERE id = p_event_id;
$$;

REVOKE ALL ON FUNCTION set_event_location FROM PUBLIC;
