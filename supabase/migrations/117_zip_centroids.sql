-- 117_zip_centroids.sql
--
-- ZIP → lat/lng so "near me" can fall back to the mother's stated ZIP.
--
-- WHY: every location-aware surface (Care, Milk, Gear, Villie Plans) funnels
-- through apps/mobile/src/utils/devLocation.ts::getEffectiveCoords, which
-- returns HARDCODED MIAMI COORDS whenever GPS permission is denied or the
-- location call fails. A mother in Hialeah who declines the location prompt
-- silently gets downtown-Miami results, and we already store her `zip_code`
-- on users. This table is the lookup that closes that gap.
--
-- This is a CACHE, not a dataset. It starts empty and is populated on demand
-- by the `geocode-zip` edge function (Google Geocoding, component-filtered to
-- postal_code + country:US). Deliberately not seeded with a bundled centroid
-- list: hand-entered coordinates go stale and we have no way to verify them,
-- whereas Google is authoritative and each ZIP is fetched at most once.
--
-- Volume is trivial — one row per distinct ZIP our users actually enter.

CREATE TABLE IF NOT EXISTS zip_centroids (
  zip         TEXT PRIMARY KEY CHECK (zip ~ '^[0-9]{5}$'),
  lat         DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng         DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  city        TEXT,
  state       TEXT,
  source      TEXT NOT NULL DEFAULT 'google_geocoding',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE zip_centroids IS
  'On-demand cache of ZIP → centroid, filled by the geocode-zip edge function. '
  'Backs the location fallback when GPS is denied. Not a seeded dataset.';

ALTER TABLE zip_centroids ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in user: these are public postal centroids, contain
-- no personal data, and the client needs them to resolve its own fallback.
-- Writes stay service-role only (the edge function owns population).
DROP POLICY IF EXISTS zip_centroids_read ON zip_centroids;
CREATE POLICY zip_centroids_read ON zip_centroids
  FOR SELECT TO authenticated
  USING (TRUE);

-- Lookup RPC. SECURITY INVOKER is fine — the read policy already allows it;
-- this exists so the client has one stable call instead of a table select,
-- and so the ZIP is normalized (ZIP+4 trimmed) in exactly one place.
CREATE OR REPLACE FUNCTION get_zip_coords(p_zip TEXT)
RETURNS TABLE (zip TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, city TEXT, state TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT z.zip, z.lat, z.lng, z.city, z.state
  FROM zip_centroids z
  WHERE z.zip = substring(regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g') from 1 for 5);
$$;

REVOKE EXECUTE ON FUNCTION get_zip_coords(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_zip_coords(TEXT) TO authenticated, service_role;

-- Upsert used by the geocode-zip edge function after a Google lookup.
-- service_role only — clients must never write centroids.
CREATE OR REPLACE FUNCTION upsert_zip_centroid(
  p_zip TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION,
  p_city TEXT, p_state TEXT
) RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  INSERT INTO zip_centroids (zip, lat, lng, city, state)
  VALUES (substring(regexp_replace(p_zip, '[^0-9]', '', 'g') from 1 for 5), p_lat, p_lng, p_city, p_state)
  ON CONFLICT (zip) DO UPDATE
    SET lat = EXCLUDED.lat, lng = EXCLUDED.lng,
        city = EXCLUDED.city, state = EXCLUDED.state,
        updated_at = now();
$$;

REVOKE EXECUTE ON FUNCTION upsert_zip_centroid(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_zip_centroid(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO service_role;

-- ── Default search radius 25mi → 10mi (founder call 2026-08-12) ───────────
--
-- The client constant DEFAULT_SEARCH_RADIUS_MILES is only the pre-hydration
-- fallback; once the profile loads, `users.search_radius_miles` wins. Changing
-- one without the other would make the client change a near no-op, so both move
-- together.
--
-- Verified safe against live Miami data before flipping: measured from 33133
-- (the ZIP cluster our users are actually in), a 10-mile radius still covers
-- 10 of 11 specialists and 8 of 8 active gear listings.
ALTER TABLE users ALTER COLUMN search_radius_miles SET DEFAULT 10;

-- Existing rows: 25 was never a deliberate choice — it was the column default
-- and the RadiusPreferenceScreen chip list ([5,10,25,50,75,100]) also offers
-- 25, so the two are indistinguishable in the data. Pre-launch (18 users, none
-- of whom have opened that screen) the right call is to move everyone still
-- sitting on the old default. Anyone who picks 25 explicitly after this
-- migration keeps it.
UPDATE users SET search_radius_miles = 10 WHERE search_radius_miles = 25;
