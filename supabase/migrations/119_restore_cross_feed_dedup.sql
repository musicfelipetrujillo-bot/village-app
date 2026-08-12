-- 119_restore_cross_feed_dedup.sql
--
-- WHY THIS MIGRATION EXISTS: 118 (event_price_passthrough) was authored as
-- a diff against migration 047's body of upsert_ingested_event. But 048
-- (v4_g2_cross_feed_dedup) later replaced the function again, adding the
-- cross-feed duplicate-detection block (find_duplicate_event / v_dup_id /
-- v_dup_feed). Nothing between 048 and 118 touched the body again — 051
-- only ran `ALTER FUNCTION ... SET search_path`, it did not CREATE OR
-- REPLACE. Because 118 started from the pre-048 body, applying it silently
-- reverted the dedup feature: two partner feeds publishing the same
-- physical event would both create cards again. Confirmed against
-- production via pg_get_functiondef — after 118, the deployed function body
-- contained neither `find_duplicate_event` nor `v_dup_id`.
--
-- This is a forward-fix, not an edit to 118 (migrations are append-only;
-- 118 is already applied and recorded in schema_migrations). It reinstates
-- 048's dedup block on top of 118's 21-param price signature. The
-- signature is UNCHANGED from 118 to 119 (still 21 params, same 2
-- defaults), so a plain CREATE OR REPLACE genuinely replaces the existing
-- function here — no DROP needed, and none is added, to avoid needless
-- grant churn.
--
-- Everything else — the 21 params/defaults, the INSERT, the ON CONFLICT DO
-- UPDATE (including the is_free/price_cents refresh added in 118), the
-- SET search_path, and the REVOKE/GRANT — is unchanged from 118.
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
  v_dup_id UUID;
  v_dup_feed UUID;
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
