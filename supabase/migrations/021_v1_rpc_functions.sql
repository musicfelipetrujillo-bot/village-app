-- V1 — RPC functions for geo-queries and rating triggers

-- Specialists near a point (uses earthdistance)
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
      ll_to_earth(lat, lng),
      ll_to_earth(s.lat, s.lng)
    ) / 1609.344) AS distance_miles
  FROM specialists s
  WHERE
    s.accepting_patients = TRUE
    AND s.lat IS NOT NULL
    AND s.lng IS NOT NULL
    AND earth_distance(
      ll_to_earth(lat, lng),
      ll_to_earth(s.lat, s.lng)
    ) / 1609.344 <= radius_miles
    AND (specialty_filter IS NULL OR s.specialty = specialty_filter)
    AND (telehealth_only = FALSE OR s.telehealth_available = TRUE)
    AND (language_filter IS NULL OR EXISTS (
      SELECT 1 FROM specialist_languages sl
      WHERE sl.specialist_id = s.id AND sl.language_code = language_filter
    ))
    AND (insurance_filter IS NULL OR EXISTS (
      SELECT 1 FROM specialist_insurances si
      WHERE si.specialist_id = s.id
        AND LOWER(si.insurance_name) LIKE LOWER('%' || insurance_filter || '%')
    ))
  ORDER BY distance_miles ASC
  LIMIT 50;
$$;

-- Recalculate specialist rating after review insert/update/delete
CREATE OR REPLACE FUNCTION recalculate_specialist_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE specialists SET
    rating_avg = (
      SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0)
      FROM reviews WHERE specialist_id = COALESCE(NEW.specialist_id, OLD.specialist_id)
    ),
    review_count = (
      SELECT COUNT(*) FROM reviews
      WHERE specialist_id = COALESCE(NEW.specialist_id, OLD.specialist_id)
    )
  WHERE id = COALESCE(NEW.specialist_id, OLD.specialist_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_rating_after_insert
  AFTER INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION recalculate_specialist_rating();
CREATE TRIGGER trg_recalc_rating_after_update
  AFTER UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION recalculate_specialist_rating();
CREATE TRIGGER trg_recalc_rating_after_delete
  AFTER DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION recalculate_specialist_rating();
