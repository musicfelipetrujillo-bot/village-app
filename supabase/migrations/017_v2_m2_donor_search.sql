-- V2 M2 — Donor search additions

-- Cache AI trust narrative on trust badge row (24h TTL)
ALTER TABLE milk_trust_badges
  ADD COLUMN IF NOT EXISTS ai_trust_narrative TEXT,
  ADD COLUMN IF NOT EXISTS ai_trust_narrative_cached_at TIMESTAMPTZ;

-- Denormalize avg rating + review count onto donor profile (updated by trigger)
ALTER TABLE milk_donor_profiles
  ADD COLUMN IF NOT EXISTS rating_avg DECIMAL(3,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0;

-- Trigger: recalculate rating on milk_reviews insert/update/delete
CREATE OR REPLACE FUNCTION update_donor_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_donor_id UUID;
BEGIN
  v_donor_id := COALESCE(NEW.donor_profile_id, OLD.donor_profile_id);
  UPDATE milk_donor_profiles SET
    rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM milk_reviews WHERE donor_profile_id = v_donor_id),
    review_count = (SELECT COUNT(*) FROM milk_reviews WHERE donor_profile_id = v_donor_id)
  WHERE id = v_donor_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_milk_review_rating
  AFTER INSERT OR UPDATE OR DELETE ON milk_reviews
  FOR EACH ROW EXECUTE FUNCTION update_donor_rating();

-- Extend search_donors_near to include rating
CREATE OR REPLACE FUNCTION search_donors_near(
  user_lat    DECIMAL,
  user_lng    DECIMAL,
  radius_miles INT     DEFAULT 25,
  filter_badge TEXT    DEFAULT NULL,
  max_price   DECIMAL  DEFAULT NULL
)
RETURNS TABLE (
  id                  UUID,
  user_id             UUID,
  display_name        VARCHAR,
  avatar_url          TEXT,
  neighborhood        VARCHAR,
  city                VARCHAR,
  state               VARCHAR,
  lat                 DECIMAL,
  lng                 DECIMAL,
  price_per_oz        DECIMAL,
  supply_oz_available INTEGER,
  is_verified         BOOLEAN,
  badge_level         VARCHAR,
  ai_safety_score     DECIMAL,
  rating_avg          DECIMAL,
  review_count        INT,
  distance_miles      FLOAT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    dp.id, dp.user_id, dp.display_name, dp.avatar_url,
    dp.neighborhood, dp.city, dp.state, dp.lat, dp.lng,
    dp.price_per_oz, dp.supply_oz_available, dp.is_verified,
    COALESCE(tb.badge_level, 'none')::VARCHAR AS badge_level,
    tb.ai_safety_score,
    dp.rating_avg, dp.review_count,
    earth_distance(ll_to_earth(user_lat, user_lng), ll_to_earth(dp.lat, dp.lng)) / 1609.34 AS distance_miles
  FROM milk_donor_profiles dp
  LEFT JOIN milk_trust_badges tb ON tb.donor_profile_id = dp.id
  WHERE dp.is_active = TRUE
    AND dp.lat IS NOT NULL AND dp.lng IS NOT NULL
    AND earth_distance(ll_to_earth(user_lat, user_lng), ll_to_earth(dp.lat, dp.lng)) / 1609.34 <= radius_miles
    AND (filter_badge IS NULL OR COALESCE(tb.badge_level, 'none') = filter_badge)
    AND (max_price IS NULL OR dp.price_per_oz <= max_price)
  ORDER BY distance_miles ASC;
$$;
