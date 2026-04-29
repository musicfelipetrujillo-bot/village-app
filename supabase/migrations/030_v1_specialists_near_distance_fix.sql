-- V1 fix: specialists_near was returning distance_miles = 0 for every row, and
-- the WHERE-clause distance filter was silently inert (every row matched),
-- because unqualified `lat`/`lng` inside the function body resolved to the
-- columns of the `specialists s` row in the FROM clause — not the function
-- parameters. `earth_distance(ll_to_earth(s.lat, s.lng), ll_to_earth(s.lat, s.lng))`
-- is always 0, so distance sort was a no-op and radius filtering never ran.
--
-- Detected by /tmp/sim-experts.png during the 2026-04-24 smoke test: every
-- specialist card in the Miami directory rendered "0.0 mi away".
--
-- Fix: hoist the function parameters into a single-row CTE with non-conflicting
-- aliases (o_lat/o_lng/...) so references inside the SELECT are unambiguous.
-- Signature is preserved exactly (parameter names, types, defaults, return
-- table) so no client change is required. PL/pgSQL was rejected here because
-- it disallows a parameter name that shadows a RETURNS TABLE out-column of
-- the same name.

CREATE OR REPLACE FUNCTION specialists_near(
  lat FLOAT,
  lng FLOAT,
  radius_miles FLOAT DEFAULT 10,
  specialty_filter TEXT DEFAULT NULL,
  language_filter TEXT DEFAULT NULL,
  insurance_filter TEXT DEFAULT NULL,
  telehealth_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  credentials TEXT,
  specialty TEXT,
  bio TEXT,
  photo_url TEXT,
  practice_name TEXT,
  city TEXT,
  state TEXT,
  lat DECIMAL,
  lng DECIMAL,
  phone TEXT,
  telehealth_available BOOLEAN,
  telehealth_link TEXT,
  accepting_patients BOOLEAN,
  years_experience INT,
  rating_avg DECIMAL,
  review_count INT,
  review_summary_cache TEXT,
  calendly_username TEXT,
  distance_miles FLOAT
)
LANGUAGE sql STABLE AS $$
  WITH params AS (
    SELECT
      specialists_near.lat              AS o_lat,
      specialists_near.lng              AS o_lng,
      specialists_near.radius_miles     AS o_radius_miles,
      specialists_near.specialty_filter AS o_specialty_filter,
      specialists_near.language_filter  AS o_language_filter,
      specialists_near.insurance_filter AS o_insurance_filter,
      specialists_near.telehealth_only  AS o_telehealth_only
  )
  SELECT
    s.id,
    s.full_name,
    s.credentials,
    s.specialty,
    s.bio,
    s.photo_url,
    s.practice_name,
    s.city,
    s.state,
    s.lat,
    s.lng,
    s.phone,
    s.telehealth_available,
    s.telehealth_link,
    s.accepting_patients,
    s.years_experience,
    s.rating_avg,
    s.review_count,
    s.review_summary_cache,
    s.calendly_username,
    (earth_distance(
      ll_to_earth(p.o_lat, p.o_lng),
      ll_to_earth(s.lat, s.lng)
    ) / 1609.344)::FLOAT AS distance_miles
  FROM specialists s, params p
  WHERE
    s.accepting_patients = TRUE
    AND s.admin_approved = TRUE
    AND s.lat IS NOT NULL
    AND s.lng IS NOT NULL
    AND earth_distance(
      ll_to_earth(p.o_lat, p.o_lng),
      ll_to_earth(s.lat, s.lng)
    ) / 1609.344 <= p.o_radius_miles
    AND (p.o_specialty_filter IS NULL OR s.specialty = p.o_specialty_filter)
    AND (p.o_telehealth_only = FALSE OR s.telehealth_available = TRUE)
    AND (p.o_language_filter IS NULL OR EXISTS (
      SELECT 1 FROM specialist_languages sl
      WHERE sl.specialist_id = s.id AND sl.language_code = p.o_language_filter
    ))
    AND (p.o_insurance_filter IS NULL OR EXISTS (
      SELECT 1 FROM specialist_insurances si
      WHERE si.specialist_id = s.id
        AND LOWER(si.insurance_name) LIKE LOWER('%' || p.o_insurance_filter || '%')
    ))
  ORDER BY distance_miles ASC
  LIMIT 50;
$$;
