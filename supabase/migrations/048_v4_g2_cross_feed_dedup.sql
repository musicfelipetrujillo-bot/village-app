-- V4 G2 — Cross-feed deduplication for ICS ingest.
--
-- Problem: when Feed A (e.g. "Mount Sinai Calendar") and Feed B (e.g.
-- a regional aggregator) both publish the same physical event, the
-- existing ON CONFLICT (source_feed_id, source_uid) clause in
-- upsert_ingested_event only dedups within a single feed. Two feeds →
-- two rows → reviewer sees the same event twice → users see two cards.
--
-- Solution: before INSERT, call find_duplicate_event (migration 046) to
-- check whether a non-cancelled event with a near-identical title +
-- start time (±90min) and location (500m) already exists. If yes, and
-- it came from a *different* feed (or no feed), bail out and return the
-- existing UUID. The first feed to publish wins; subsequent feeds detect
-- and skip.
--
-- We do NOT touch same-feed re-syncs — that path stays on the existing
-- ON CONFLICT (source_feed_id, source_uid) update so a partner can fix
-- a typo or reschedule and have it propagate normally.
--
-- Trade-off accepted: each cron run will re-detect the cross-feed dupe
-- (find_duplicate_event runs ~50 times/sweep). At our scale that's
-- negligible — a per-(feed, source_uid)→event_id alias table would be
-- tighter but is scope creep until ingest > a few hundred/day.
--
-- Idempotent: re-running this migration is safe.

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
  v_dup_id UUID;
  v_dup_feed UUID;
BEGIN
  IF p_type = 'local' THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      v_geo := ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography;
      v_needs_geocode := TRUE;
    ELSE
      v_geo := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
    END IF;
  END IF;

  -- Cross-feed dedup probe: skip when the same (feed, source_uid) pair
  -- is already on disk — that's a same-feed re-sync and the ON CONFLICT
  -- clause below handles it correctly. We only want to short-circuit
  -- when find_duplicate_event matches a row from a DIFFERENT feed.
  IF p_source_feed_id IS NOT NULL AND p_source_uid IS NOT NULL THEN
    PERFORM 1 FROM events
      WHERE source_feed_id = p_source_feed_id
        AND source_uid = p_source_uid;
    IF NOT FOUND THEN
      v_dup_id := find_duplicate_event(p_title, p_starts_at, p_lat, p_lng);
      IF v_dup_id IS NOT NULL THEN
        SELECT source_feed_id INTO v_dup_feed FROM events WHERE id = v_dup_id;
        IF v_dup_feed IS DISTINCT FROM p_source_feed_id THEN
          -- Cross-feed dupe — first feed wins. Return existing ID without
          -- mutating any fields. This makes the second feed's ingest a
          -- no-op visible only as a count in the function logs.
          RETURN v_dup_id;
        END IF;
      END IF;
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
    ends_at           = EXCLUDED.ends_at,
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
