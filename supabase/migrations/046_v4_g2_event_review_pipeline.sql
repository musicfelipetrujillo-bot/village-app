-- V4 G2 — Event review pipeline (Pass 2 of self-sustaining events ingest)
--
-- Builds on migration 045 (ICS partner feeds) by inserting an AI-screened
-- review step between ingest and public visibility. Mirrors the clinical-
-- review pattern (migrations 042 + 043) so reviewers can use Supabase
-- Studio or the in-app dashboard to approve/reject candidates.
--
-- Flow:
--   ICS pull → events row inserted with review_status='pending'
--                 ↓
--           ai-event-screen (Haiku) sets ingestion_confidence
--                 ↓
--   confidence ≥ feed.auto_publish_threshold (default 0.85)
--     → review_status='approved' + auto_published_at=now()
--   confidence 0.55–0.85
--     → review_status='pending' (visible only to event reviewers)
--   confidence < 0.55
--     → review_status='rejected' + ingestion_notes='ai_low_confidence'
--
-- Manually curated events (insert without source_feed_id) default to
-- review_status='approved' so the existing ops flow continues to work.
-- Existing rows backfill to 'approved' so the cutover is non-breaking.
--
-- Pre-launch gates:
--   - ai-event-screen edge function deployed (this migration is otherwise
--     a no-op — events still flow but every ingested event sits at
--     'pending' until a human approves)
--   - At least one user with is_event_reviewer=TRUE for the dashboard to
--     have an audience

-- ────────────────────────────────────────────────────────────────────────────
-- users.is_event_reviewer — separate from is_clinical_reviewer
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_event_reviewer BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.is_event_reviewer IS
  'TRUE for ops staff who can approve/reject AI-screened event candidates. '
  'Distinct from is_clinical_reviewer (medical content). Toggle in DB:'
  ' UPDATE users SET is_event_reviewer = TRUE WHERE email = ''…'';';

CREATE OR REPLACE FUNCTION is_event_reviewer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT is_event_reviewer FROM users WHERE id = auth.uid()),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION is_event_reviewer TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- events: review pipeline columns
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS ingestion_confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ingestion_notes TEXT,                 -- AI rationale or rejection reason
  ADD COLUMN IF NOT EXISTS auto_published_at TIMESTAMPTZ,        -- set when AI auto-approves
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suggested_age_tags TEXT[];            -- AI-suggested, applied on approval

CREATE INDEX IF NOT EXISTS idx_events_review_status_pending
  ON events(review_status, created_at DESC)
  WHERE review_status = 'pending';

-- Existing rows (curated seed events from migration 010, anything ingested
-- pre-migration) are already 'approved' via the column DEFAULT — no
-- explicit backfill needed.

-- events_partner_feeds — per-feed auto-publish threshold so trusted
-- partners (signed agreement, hospital QA) skip AI screening + review
ALTER TABLE events_partner_feeds
  ADD COLUMN IF NOT EXISTS auto_publish_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.85
    CHECK (auto_publish_threshold BETWEEN 0 AND 1);

COMMENT ON COLUMN events_partner_feeds.auto_publish_threshold IS
  'Confidence ≥ this auto-approves; below this sits in review queue. '
  'Set to 0.0 for fully-trusted partners (hospital ICS feeds with signed '
  'agreement). Default 0.85 = high bar for aggregator feeds.';

-- ────────────────────────────────────────────────────────────────────────────
-- RLS — public reads filter to approved; reviewers see pending too
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_public_read" ON events;

CREATE POLICY "events_public_read" ON events
  FOR SELECT USING (
    status IN ('upcoming', 'live', 'ended')
    AND review_status = 'approved'
  );

-- Reviewers see everything (pending + rejected) so they can audit decisions.
CREATE POLICY "events_reviewer_read" ON events
  FOR SELECT TO authenticated
  USING (is_event_reviewer());

-- ────────────────────────────────────────────────────────────────────────────
-- list_events_near update — filter to approved (defense in depth)
-- ────────────────────────────────────────────────────────────────────────────
-- The RLS policy above already filters non-reviewer queries, but the RPC
-- adds an explicit guard so a future caller invoked with elevated rights
-- still doesn't accidentally surface pending content.

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
    AND e.review_status = 'approved'
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

-- ────────────────────────────────────────────────────────────────────────────
-- Cross-feed dedup helper — finds an existing event that looks like a
-- duplicate of the candidate. Title is normalized (lower + collapsed
-- whitespace) and matched on prefix; start time is matched within ±90min;
-- location is matched within 500m when both have geo.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION find_duplicate_event(
  p_title TEXT,
  p_starts_at TIMESTAMPTZ,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS UUID LANGUAGE sql STABLE AS $$
  WITH norm AS (
    SELECT lower(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')) AS t
  )
  SELECT e.id
    FROM events e, norm
   WHERE e.starts_at BETWEEN p_starts_at - INTERVAL '90 minutes'
                         AND p_starts_at + INTERVAL '90 minutes'
     AND e.status <> 'cancelled'
     AND lower(regexp_replace(e.title, '\s+', ' ', 'g'))
         LIKE substr(norm.t, 1, 40) || '%'
     AND (
       p_lat IS NULL OR p_lng IS NULL OR e.location IS NULL
       OR ST_DWithin(
            e.location,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            500
          )
     )
   ORDER BY e.created_at ASC
   LIMIT 1;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Reviewer RPCs — used by Me-screen "Event review" dashboard
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION list_pending_events()
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  type TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  city TEXT,
  venue_name TEXT,
  stream_url TEXT,
  host_name TEXT,
  is_partner BOOLEAN,
  is_third_party BOOLEAN,
  age_tags TEXT[],
  suggested_age_tags TEXT[],
  ingestion_confidence DOUBLE PRECISION,
  ingestion_notes TEXT,
  source_feed_id UUID,
  source_partner_name TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    e.id, e.title, e.description, e.type,
    e.starts_at, e.ends_at, e.city, e.venue_name, e.stream_url,
    e.host_name, e.is_partner, e.is_third_party,
    e.age_tags, e.suggested_age_tags,
    e.ingestion_confidence, e.ingestion_notes,
    e.source_feed_id, f.partner_name AS source_partner_name,
    e.created_at
  FROM events e
  LEFT JOIN events_partner_feeds f ON f.id = e.source_feed_id
  WHERE is_event_reviewer()
    AND e.review_status = 'pending'
    AND e.ends_at > now()
  ORDER BY e.starts_at ASC;
$$;

GRANT EXECUTE ON FUNCTION list_pending_events TO authenticated;

CREATE OR REPLACE FUNCTION approve_event(
  p_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_age_tags TEXT[] DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_event_reviewer() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE events
    SET review_status   = 'approved',
        reviewed_by     = auth.uid(),
        reviewed_at     = now(),
        ingestion_notes = COALESCE(p_notes, ingestion_notes),
        age_tags        = COALESCE(p_age_tags, age_tags)
    WHERE id = p_id
      AND review_status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event not found or not pending' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_event TO authenticated;

CREATE OR REPLACE FUNCTION reject_event(
  p_id UUID,
  p_notes TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_event_reviewer() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_notes IS NULL OR length(trim(p_notes)) < 3 THEN
    RAISE EXCEPTION 'rejection notes required (min 3 chars)' USING ERRCODE = '22023';
  END IF;

  UPDATE events
    SET review_status   = 'rejected',
        reviewed_by     = auth.uid(),
        reviewed_at     = now(),
        ingestion_notes = p_notes
    WHERE id = p_id
      AND review_status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event not found or not pending' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION reject_event TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- set_event_location — service-role helper for events-geocode edge function
-- (PostGIS GEOGRAPHY(Point,4326) construction is awkward from supabase-js,
-- so the geocoder calls this RPC with plain lat/lng numbers.)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_event_location(
  p_event_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE events
     SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
   WHERE id = p_event_id;
$$;

REVOKE ALL ON FUNCTION set_event_location FROM PUBLIC;

-- ────────────────────────────────────────────────────────────────────────────
-- upsert_ingested_event — service-role helper used by events-ingest-ics.
--
-- Centralizes the insert/update path so the JS ingest doesn't have to
-- juggle PostGIS construction. When p_lat/p_lng are NULL, a sentinel
-- (0,0) is used to satisfy the local_has_location CHECK; events-geocode
-- overwrites the geometry after the post-insert hook resolves a real
-- address. The row stays review_status='pending' the whole time, so
-- public users never see the sentinel-located row.
--
-- Idempotent on (source_feed_id, source_uid).
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
BEGIN
  IF p_type = 'local' THEN
    -- Use real coords when given; otherwise Null-Island sentinel until
    -- events-geocode resolves the address.
    v_geo := ST_SetSRID(
      ST_MakePoint(COALESCE(p_lng, 0), COALESCE(p_lat, 0)),
      4326
    )::geography;
  END IF;

  INSERT INTO events (
    type, title, description, host_name, host_avatar_url,
    is_partner, is_third_party,
    starts_at, ends_at, timezone, age_tags,
    venue_name, address, city, location,
    stream_url, platform,
    is_free, status, review_status,
    source_feed_id, source_uid, source_synced_at
  ) VALUES (
    p_type, p_title, p_description, p_host_name, p_host_avatar_url,
    p_is_partner, TRUE,                                  -- is_third_party always TRUE for ingested
    p_starts_at, p_ends_at, p_timezone, COALESCE(p_age_tags, '{}'),
    p_venue_name, p_address, p_city, v_geo,
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
    -- DO NOT clobber age_tags or location on update — they may have been
    -- improved by ai-event-screen / events-geocode since the last pull.
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
-- service_role only.
-- service_role only — no GRANT to authenticated/anon. The events-geocode
-- function calls this with the service-role key. A non-service-role caller
-- shouldn't be able to fabricate locations.

-- ────────────────────────────────────────────────────────────────────────────
-- pg_cron — daily AI screen sweep (catches anything ingest didn't screen
-- inline, e.g. failures or backfills) + nightly geocode sweep
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-event-screen-sweep') THEN
      PERFORM cron.unschedule('ai-event-screen-sweep');
    END IF;

    -- 09:30 UTC = 30min after the ICS ingest cron fires (045). Gives the
    -- inline screen calls time to finish; this sweep mops up any rows the
    -- inline path missed (timeout, transient AI error, manual insert).
    PERFORM cron.schedule(
      'ai-event-screen-sweep',
      '30 9 * * *',
      $cron$
      SELECT net.http_post(
        url     := current_setting('app.supabase_url') || '/functions/v1/ai-event-screen',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body    := '{"mode":"all","limit":50}'::jsonb
      );
      $cron$
    );

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'events-geocode-sweep') THEN
      PERFORM cron.unschedule('events-geocode-sweep');
    END IF;

    -- 09:45 UTC — runs after the screen sweep so newly-geocoded events
    -- can be re-screened on the next run.
    PERFORM cron.schedule(
      'events-geocode-sweep',
      '45 9 * * *',
      $cron$
      SELECT net.http_post(
        url     := current_setting('app.supabase_url') || '/functions/v1/events-geocode',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body    := '{"mode":"all","limit":50}'::jsonb
      );
      $cron$
    );
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;
