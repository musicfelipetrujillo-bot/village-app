-- 118_event_price_passthrough.sql
--
-- Adds price pass-through to upsert_ingested_event.
--
-- WHY: the function hardcodes is_free = TRUE for every ingested event. Four
-- researched postpartum sources were rejected because their pages mix free
-- with paid ($30-$480) groups, and registering them would have advertised
-- paid programs as free. See
-- docs/superpowers/specs/2026-08-12-villie-plans-per-event-attributes-design.md
--
-- Both columns already exist on `events` (is_free BOOLEAN NOT NULL DEFAULT
-- true, price_cents INTEGER NULL), so this is a signature change only.
--
-- The two new parameters are LAST and DEFAULTED to today's behavior, so the
-- existing caller `events-ingest-ics` keeps working untouched.
--
-- ⚠️ The DROP below is REQUIRED, not tidiness. `CREATE OR REPLACE FUNCTION`
-- only replaces a function with the SAME argument list. Adding two parameters
-- creates a second, OVERLOADED function, and every existing 19-argument call
-- then fails with "function is not unique" because the 21-arg version's
-- defaults make it equally applicable. This repo has already been bitten by
-- the same class of bug (see migration 023 / get_gear_listing).
DROP FUNCTION IF EXISTS upsert_ingested_event(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ,
  TEXT, TEXT[], TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT
);

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
  p_platform TEXT,
  p_is_free BOOLEAN DEFAULT TRUE,
  p_price_cents INTEGER DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_id UUID;
  v_geo GEOGRAPHY(Point, 4326);
  v_needs_geocode BOOLEAN := FALSE;
BEGIN
  IF p_type = 'local' THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      -- Null-Island sentinel until events-geocode resolves the address.
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
    is_free, price_cents, status, review_status,
    source_feed_id, source_uid, source_synced_at
  ) VALUES (
    p_type, p_title, p_description, p_host_name, p_host_avatar_url,
    p_is_partner, TRUE,
    p_starts_at, p_ends_at, p_timezone, COALESCE(p_age_tags, '{}'),
    p_venue_name, p_address, p_city, v_geo, v_needs_geocode,
    p_stream_url, p_platform,
    p_is_free, p_price_cents, 'upcoming', 'pending',
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
    -- Price DOES refresh on re-harvest: if a venue starts charging for a
    -- previously free group, the card must stop saying "Free".
    is_free          = EXCLUDED.is_free,
    price_cents      = EXCLUDED.price_cents,
    source_synced_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_ingested_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_ingested_event TO service_role;
