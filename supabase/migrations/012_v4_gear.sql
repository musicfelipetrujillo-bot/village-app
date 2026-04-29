-- V4 Phase G4 — Gear DB + browse (no CPSC, no vision, no payments yet)
-- Spec: docs/source/Village_Feature_Specs.md § Spec 5 (Gear Marketplace)
--       docs/source/Village_Risk_and_Compliance.md § Part 2 (Baby Gear Marketplace)
--
-- Compliance posture (DB-level, per Risk & Compliance §2.2):
--   * Category enum is an ALLOWLIST. Prohibited categories (car_seat, breast_pump,
--     sleep_positioner, inclined_sleeper, helmet) are not members — they cannot be
--     inserted at all.
--   * year_manufactured CHECK: toys ≥ 1978 (no lead-paint toys), cribs ≥ 2011
--     (drop-side crib ban; 16 CFR 1219).
--   * CPSC recall-API cross-check lands in G5.
--   * AI vision listing assist lands in G5.
--   * Messaging + Safe Meeting Guide + Legal Disclosure modal land in G6.
--   * Payments land in G8 (after FinCEN counsel review).

-- ────────────────────────────────────────────────────────────────────────────
-- gear_listings
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE gear_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Category: ALLOWLIST. Adding new categories requires Risk-review sign-off.
  category TEXT NOT NULL CHECK (category IN (
    'stroller',
    'carrier_wrap',
    'high_chair',
    'bouncer_swing',
    'toy',
    'feeding_gear',
    'clothing',
    'book',
    'activity_center',
    'nursery_furniture'
  )),
  subcategory TEXT,                                   -- free text; UI picks from per-category list

  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 80),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 10 AND 2000),

  brand TEXT,
  model TEXT,
  year_manufactured INTEGER,                          -- used by CHECK below + G5 CPSC check
  condition TEXT NOT NULL CHECK (condition IN ('new','like_new','good','fair')),
  age_tags TEXT[] NOT NULL DEFAULT '{}',              -- same vocab as events: pregnancy/0-3mo/...

  -- Pricing
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  is_free BOOLEAN NOT NULL DEFAULT FALSE,             -- "give it away" listings
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (length(currency) = 3),

  -- Location
  pickup_city TEXT NOT NULL,
  pickup_zip TEXT,
  location GEOGRAPHY(Point, 4326) NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','pending','sold','withdrawn','removed')),
  removed_reason TEXT,                                -- set by mod action (CPSC, report, etc.)
  is_cpsc_checked BOOLEAN NOT NULL DEFAULT FALSE,     -- toggled true in G5 after recall check

  view_count INTEGER NOT NULL DEFAULT 0,
  save_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Lead-paint toys banned federally (16 CFR 1303; toys manufactured after
  -- 1978 cleared the switch to lead-free paint). Toys without a year are NOT
  -- allowed — pre-G5 we cannot verify via vision, so force year disclosure.
  CONSTRAINT toy_year_safe CHECK (
    category <> 'toy' OR (year_manufactured IS NOT NULL AND year_manufactured >= 1978)
  ),
  -- Drop-side cribs banned June 2011 (CPSC Final Rule 16 CFR 1219). Also
  -- forces year disclosure so a future scan can pick up recall-era cribs.
  CONSTRAINT crib_year_safe CHECK (
    category <> 'nursery_furniture'
    OR subcategory IS DISTINCT FROM 'crib'
    OR (year_manufactured IS NOT NULL AND year_manufactured >= 2011)
  )
);

CREATE INDEX idx_gear_listings_seller    ON gear_listings(seller_id);
CREATE INDEX idx_gear_listings_status    ON gear_listings(status);
CREATE INDEX idx_gear_listings_category  ON gear_listings(category);
CREATE INDEX idx_gear_listings_created   ON gear_listings(created_at DESC);
CREATE INDEX idx_gear_listings_location  ON gear_listings USING GIST(location);
CREATE INDEX idx_gear_listings_age_tags  ON gear_listings USING GIN(age_tags);

CREATE OR REPLACE FUNCTION touch_gear_listings_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_gear_listings_updated_at
  BEFORE UPDATE ON gear_listings
  FOR EACH ROW EXECUTE FUNCTION touch_gear_listings_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- gear_listing_images  (1:many, ordered)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE gear_listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES gear_listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, sort_order)
);
CREATE INDEX idx_gear_images_listing ON gear_listing_images(listing_id, sort_order);

-- ────────────────────────────────────────────────────────────────────────────
-- gear_saved_listings  — per-user wishlist
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE gear_saved_listings (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES gear_listings(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX idx_gear_saved_user ON gear_saved_listings(user_id, saved_at DESC);

-- save_count trigger (denormalized counter on listing row)
CREATE OR REPLACE FUNCTION bump_gear_save_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE gear_listings SET save_count = save_count + 1 WHERE id = NEW.listing_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE gear_listings SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.listing_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gear_save_count_insert AFTER INSERT ON gear_saved_listings
  FOR EACH ROW EXECUTE FUNCTION bump_gear_save_count();
CREATE TRIGGER trg_gear_save_count_delete AFTER DELETE ON gear_saved_listings
  FOR EACH ROW EXECUTE FUNCTION bump_gear_save_count();

-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE gear_listings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear_listing_images  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear_saved_listings  ENABLE ROW LEVEL SECURITY;

-- Listings: public read of active/pending/sold; sellers read own (any status); sellers write own.
CREATE POLICY "gear_listings_public_read" ON gear_listings
  FOR SELECT USING (status IN ('active','pending','sold'));
CREATE POLICY "gear_listings_owner_read" ON gear_listings
  FOR SELECT USING (seller_id = auth.uid());
CREATE POLICY "gear_listings_owner_write" ON gear_listings
  FOR INSERT WITH CHECK (seller_id = auth.uid());
CREATE POLICY "gear_listings_owner_update" ON gear_listings
  FOR UPDATE USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
CREATE POLICY "gear_listings_service_override" ON gear_listings
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Images: public read where parent listing is publicly readable; seller writes own.
CREATE POLICY "gear_images_public_read" ON gear_listing_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM gear_listings l
      WHERE l.id = gear_listing_images.listing_id
        AND (l.status IN ('active','pending','sold') OR l.seller_id = auth.uid())
    )
  );
CREATE POLICY "gear_images_owner_write" ON gear_listing_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM gear_listings l
      WHERE l.id = gear_listing_images.listing_id AND l.seller_id = auth.uid()
    )
  );
CREATE POLICY "gear_images_owner_delete" ON gear_listing_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM gear_listings l
      WHERE l.id = gear_listing_images.listing_id AND l.seller_id = auth.uid()
    )
  );

-- Saved: own only.
CREATE POLICY "gear_saved_own_all" ON gear_saved_listings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: list_gear_near — category + age + price filters, distance sort
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION list_gear_near(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 50,
  p_category TEXT DEFAULT NULL,
  p_age_tags TEXT[] DEFAULT NULL,
  p_max_price_cents INTEGER DEFAULT NULL,
  p_include_free BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  category TEXT,
  subcategory TEXT,
  brand TEXT,
  condition TEXT,
  age_tags TEXT[],
  price_cents INTEGER,
  is_free BOOLEAN,
  currency TEXT,
  pickup_city TEXT,
  distance_km DOUBLE PRECISION,
  is_cpsc_checked BOOLEAN,
  cover_image_url TEXT,
  save_count INTEGER,
  created_at TIMESTAMPTZ
) LANGUAGE sql STABLE AS $$
  SELECT
    l.id, l.title, l.category, l.subcategory, l.brand, l.condition,
    l.age_tags, l.price_cents, l.is_free, l.currency,
    l.pickup_city,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
      THEN ST_Distance(l.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000.0
    END AS distance_km,
    l.is_cpsc_checked,
    (SELECT image_url FROM gear_listing_images i
       WHERE i.listing_id = l.id ORDER BY i.sort_order LIMIT 1) AS cover_image_url,
    l.save_count,
    l.created_at
  FROM gear_listings l
  WHERE l.status = 'active'
    AND (p_category IS NULL OR l.category = p_category)
    AND (p_age_tags IS NULL OR cardinality(l.age_tags) = 0 OR l.age_tags && p_age_tags)
    AND (p_max_price_cents IS NULL OR l.price_cents <= p_max_price_cents)
    AND (p_include_free = TRUE OR l.is_free = FALSE)
    AND (
      p_lat IS NULL OR p_lng IS NULL
      OR ST_DWithin(l.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000)
    )
  ORDER BY
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
      THEN ST_Distance(l.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
      ELSE 0
    END,
    l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION list_gear_near TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: create_gear_listing — owner-scoped insert with PostGIS point construction
-- (supabase-js can't send GEOGRAPHY types directly). Images are inserted
-- separately by the client.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_gear_listing(
  p_category TEXT,
  p_subcategory TEXT,
  p_title TEXT,
  p_description TEXT,
  p_brand TEXT,
  p_model TEXT,
  p_year_manufactured INTEGER,
  p_condition TEXT,
  p_age_tags TEXT[],
  p_price_cents INTEGER,
  p_is_free BOOLEAN,
  p_pickup_city TEXT,
  p_pickup_zip TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
) RETURNS TABLE (id UUID)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;

  INSERT INTO gear_listings (
    seller_id, category, subcategory, title, description, brand, model,
    year_manufactured, condition, age_tags, price_cents, is_free,
    pickup_city, pickup_zip, location
  ) VALUES (
    v_user, p_category, p_subcategory, p_title, p_description, p_brand, p_model,
    p_year_manufactured, p_condition, COALESCE(p_age_tags, '{}'),
    GREATEST(p_price_cents, 0), COALESCE(p_is_free, FALSE),
    p_pickup_city, p_pickup_zip,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  ) RETURNING gear_listings.id INTO v_id;

  RETURN QUERY SELECT v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_gear_listing TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: get_gear_listing — single listing + images + seller basics + saved flag
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_gear_listing(p_id UUID)
RETURNS TABLE (
  id UUID, seller_id UUID,
  category TEXT, subcategory TEXT,
  title TEXT, description TEXT,
  brand TEXT, model TEXT, year_manufactured INTEGER, condition TEXT,
  age_tags TEXT[],
  price_cents INTEGER, is_free BOOLEAN, currency TEXT,
  pickup_city TEXT, pickup_zip TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  status TEXT, is_cpsc_checked BOOLEAN,
  view_count INTEGER, save_count INTEGER,
  created_at TIMESTAMPTZ,
  images JSONB,
  is_saved BOOLEAN,
  seller_name TEXT, seller_avatar_url TEXT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    l.id, l.seller_id,
    l.category, l.subcategory,
    l.title, l.description,
    l.brand, l.model, l.year_manufactured, l.condition,
    l.age_tags,
    l.price_cents, l.is_free, l.currency,
    l.pickup_city, l.pickup_zip,
    ST_Y(l.location::geometry) AS lat,
    ST_X(l.location::geometry) AS lng,
    l.status, l.is_cpsc_checked,
    l.view_count, l.save_count,
    l.created_at,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', i.id, 'url', i.image_url, 'sort', i.sort_order)
              ORDER BY i.sort_order)
         FROM gear_listing_images i WHERE i.listing_id = l.id),
      '[]'::jsonb
    ) AS images,
    EXISTS (
      SELECT 1 FROM gear_saved_listings s
      WHERE s.listing_id = l.id AND s.user_id = auth.uid()
    ) AS is_saved,
    COALESCE(u.raw_user_meta_data->>'full_name',
             split_part(u.email, '@', 1)) AS seller_name,
    u.raw_user_meta_data->>'avatar_url' AS seller_avatar_url
  FROM gear_listings l
  LEFT JOIN auth.users u ON u.id = l.seller_id
  WHERE l.id = p_id
    AND (l.status IN ('active','pending','sold') OR l.seller_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION get_gear_listing TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: list_my_gear_listings
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION list_my_gear_listings()
RETURNS TABLE (
  id UUID, title TEXT, category TEXT, status TEXT,
  price_cents INTEGER, is_free BOOLEAN, currency TEXT,
  view_count INTEGER, save_count INTEGER,
  created_at TIMESTAMPTZ,
  cover_image_url TEXT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    l.id, l.title, l.category, l.status,
    l.price_cents, l.is_free, l.currency,
    l.view_count, l.save_count, l.created_at,
    (SELECT image_url FROM gear_listing_images i
       WHERE i.listing_id = l.id ORDER BY i.sort_order LIMIT 1) AS cover_image_url
  FROM gear_listings l
  WHERE l.seller_id = auth.uid()
  ORDER BY l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION list_my_gear_listings TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: list_my_saved_gear
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION list_my_saved_gear()
RETURNS TABLE (
  id UUID, title TEXT, category TEXT, price_cents INTEGER, is_free BOOLEAN,
  currency TEXT, pickup_city TEXT, cover_image_url TEXT, saved_at TIMESTAMPTZ,
  status TEXT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    l.id, l.title, l.category, l.price_cents, l.is_free, l.currency,
    l.pickup_city,
    (SELECT image_url FROM gear_listing_images i
       WHERE i.listing_id = l.id ORDER BY i.sort_order LIMIT 1),
    s.saved_at,
    l.status
  FROM gear_saved_listings s
  JOIN gear_listings l ON l.id = s.listing_id
  WHERE s.user_id = auth.uid()
  ORDER BY s.saved_at DESC;
$$;

GRANT EXECUTE ON FUNCTION list_my_saved_gear TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Seed: 6 sample listings + images (Miami area). Seeds under the first user
-- found in auth.users. If no users exist yet, seeds are skipped (safe).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_seller UUID;
  v_id_stroller UUID;
  v_id_highchair UUID;
  v_id_carrier UUID;
  v_id_toy UUID;
  v_id_activity UUID;
  v_id_clothing UUID;
BEGIN
  SELECT id INTO v_seller FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_seller IS NULL THEN
    RAISE NOTICE '[012_v4_gear] no auth.users yet — skipping gear seed';
    RETURN;
  END IF;

  INSERT INTO gear_listings (
    seller_id, category, subcategory, title, description, brand, model,
    year_manufactured, condition, age_tags, price_cents, is_free, currency,
    pickup_city, pickup_zip, location
  ) VALUES
    (v_seller, 'stroller', 'lightweight',
     'UPPAbaby Minu V2 stroller — excellent condition',
     'Travel stroller used for 8 months, kept indoors. Folds to carry-on size. Includes rain cover and cup holder. Non-smoking home, no pets.',
     'UPPAbaby', 'Minu V2', 2023, 'like_new', ARRAY['3-6mo','6-12mo','12mo+'],
     29900, FALSE, 'USD', 'Miami', '33131',
     ST_SetSRID(ST_MakePoint(-80.1918, 25.7617), 4326)::geography)
     RETURNING id INTO v_id_stroller;

  INSERT INTO gear_listings (
    seller_id, category, subcategory, title, description, brand, model,
    year_manufactured, condition, age_tags, price_cents, is_free, currency,
    pickup_city, pickup_zip, location
  ) VALUES
    (v_seller, 'high_chair', 'convertible',
     'Stokke Tripp Trapp high chair + baby set',
     'Natural beech wood Tripp Trapp with the Baby Set attachment. Grows from 6mo to teenage. Dismantles flat for pickup.',
     'Stokke', 'Tripp Trapp', 2022, 'good', ARRAY['6-12mo','12mo+'],
     18000, FALSE, 'USD', 'Coral Gables', '33134',
     ST_SetSRID(ST_MakePoint(-80.2684, 25.7214), 4326)::geography)
     RETURNING id INTO v_id_highchair;

  INSERT INTO gear_listings (
    seller_id, category, subcategory, title, description, brand, model,
    year_manufactured, condition, age_tags, price_cents, is_free, currency,
    pickup_city, pickup_zip, location
  ) VALUES
    (v_seller, 'carrier_wrap', 'structured',
     'Ergobaby Omni 360 carrier — like new',
     'Used a handful of times. All four carry positions. Machine washable. Includes the infant insert.',
     'Ergobaby', 'Omni 360', 2024, 'like_new', ARRAY['0-3mo','3-6mo','6-12mo'],
     7500, FALSE, 'USD', 'Miami Beach', '33139',
     ST_SetSRID(ST_MakePoint(-80.1300, 25.7907), 4326)::geography)
     RETURNING id INTO v_id_carrier;

  INSERT INTO gear_listings (
    seller_id, category, subcategory, title, description, brand, model,
    year_manufactured, condition, age_tags, price_cents, is_free, currency,
    pickup_city, pickup_zip, location
  ) VALUES
    (v_seller, 'toy', 'wooden',
     'Melissa & Doug wooden puzzle bundle (4 puzzles)',
     'Chunky wooden peg puzzles — farm, zoo, numbers, letters. Wiped down. All pieces present.',
     'Melissa & Doug', NULL, 2022, 'good', ARRAY['12mo+'],
     2500, FALSE, 'USD', 'Coconut Grove', '33133',
     ST_SetSRID(ST_MakePoint(-80.2434, 25.7282), 4326)::geography)
     RETURNING id INTO v_id_toy;

  INSERT INTO gear_listings (
    seller_id, category, subcategory, title, description, brand, model,
    year_manufactured, condition, age_tags, price_cents, is_free, currency,
    pickup_city, pickup_zip, location
  ) VALUES
    (v_seller, 'activity_center', 'playmat',
     'Lovevery Play Gym — free to a good home',
     'Complete gym with all 5 stages of accessories. Lightly used. Giving away to help another family.',
     'Lovevery', 'Play Gym', 2023, 'good', ARRAY['0-3mo','3-6mo'],
     0, TRUE, 'USD', 'Brickell', '33130',
     ST_SetSRID(ST_MakePoint(-80.1900, 25.7600), 4326)::geography)
     RETURNING id INTO v_id_activity;

  INSERT INTO gear_listings (
    seller_id, category, subcategory, title, description, brand, model,
    year_manufactured, condition, age_tags, price_cents, is_free, currency,
    pickup_city, pickup_zip, location
  ) VALUES
    (v_seller, 'clothing', 'bundle',
     'Baby clothes bundle — 6-9mo neutral (20+ pieces)',
     'Mostly H&M, Gap Baby, Carter''s. Onesies, rompers, sleepers, a few outerwear pieces. Gender-neutral palette.',
     NULL, NULL, NULL, 'good', ARRAY['6-12mo'],
     4500, FALSE, 'USD', 'South Miami', '33143',
     ST_SetSRID(ST_MakePoint(-80.2939, 25.7076), 4326)::geography)
     RETURNING id INTO v_id_clothing;

  INSERT INTO gear_listing_images (listing_id, image_url, sort_order) VALUES
    (v_id_stroller,  'https://images.unsplash.com/photo-1556484687-30636164638b?w=900', 0),
    (v_id_highchair, 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=900', 0),
    (v_id_carrier,   'https://images.unsplash.com/photo-1604468541196-f8cffdff1eb0?w=900', 0),
    (v_id_toy,       'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=900', 0),
    (v_id_activity,  'https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=900', 0),
    (v_id_clothing,  'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=900', 0);
END $$;
