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
    RAISE EXCEPTION 'No user found — sign up in the app first.';
  END IF;

  INSERT INTO gear_listings (seller_id, category, subcategory, title, description, brand, model, year_manufactured, condition, age_tags, price_cents, is_free, currency, pickup_city, pickup_zip, location) VALUES
    (v_seller, 'stroller', 'lightweight',
     'UPPAbaby Minu V2 stroller — excellent condition',
     'Travel stroller used for 8 months, kept indoors. Folds to carry-on size. Includes rain cover and cup holder. Non-smoking home, no pets.',
     'UPPAbaby', 'Minu V2', 2023, 'like_new', ARRAY['3-6mo','6-12mo','12mo+'],
     29900, FALSE, 'USD', 'Miami', '33131',
     ST_SetSRID(ST_MakePoint(-80.1918, 25.7617), 4326)::geography) RETURNING id INTO v_id_stroller;

  INSERT INTO gear_listings (seller_id, category, subcategory, title, description, brand, model, year_manufactured, condition, age_tags, price_cents, is_free, currency, pickup_city, pickup_zip, location) VALUES
    (v_seller, 'high_chair', 'convertible',
     'Stokke Tripp Trapp high chair + baby set',
     'Natural beech wood Tripp Trapp with the Baby Set attachment. Grows from 6mo to teenage. Dismantles flat for pickup.',
     'Stokke', 'Tripp Trapp', 2022, 'good', ARRAY['6-12mo','12mo+'],
     18000, FALSE, 'USD', 'Coral Gables', '33134',
     ST_SetSRID(ST_MakePoint(-80.2684, 25.7214), 4326)::geography) RETURNING id INTO v_id_highchair;

  INSERT INTO gear_listings (seller_id, category, subcategory, title, description, brand, model, year_manufactured, condition, age_tags, price_cents, is_free, currency, pickup_city, pickup_zip, location) VALUES
    (v_seller, 'carrier_wrap', 'structured',
     'Ergobaby Omni 360 carrier — like new',
     'Used a handful of times. All four carry positions. Machine washable. Includes the infant insert.',
     'Ergobaby', 'Omni 360', 2024, 'like_new', ARRAY['0-3mo','3-6mo','6-12mo'],
     7500, FALSE, 'USD', 'Miami Beach', '33139',
     ST_SetSRID(ST_MakePoint(-80.1300, 25.7907), 4326)::geography) RETURNING id INTO v_id_carrier;

  INSERT INTO gear_listings (seller_id, category, subcategory, title, description, brand, model, year_manufactured, condition, age_tags, price_cents, is_free, currency, pickup_city, pickup_zip, location) VALUES
    (v_seller, 'toy', 'wooden',
     'Melissa & Doug wooden puzzle bundle (4 puzzles)',
     'Chunky wooden peg puzzles — farm, zoo, numbers, letters. Wiped down. All pieces present.',
     'Melissa & Doug', NULL, 2022, 'good', ARRAY['12mo+'],
     2500, FALSE, 'USD', 'Coconut Grove', '33133',
     ST_SetSRID(ST_MakePoint(-80.2434, 25.7282), 4326)::geography) RETURNING id INTO v_id_toy;

  INSERT INTO gear_listings (seller_id, category, subcategory, title, description, brand, model, year_manufactured, condition, age_tags, price_cents, is_free, currency, pickup_city, pickup_zip, location) VALUES
    (v_seller, 'activity_center', 'playmat',
     'Lovevery Play Gym — free to a good home',
     'Complete gym with all 5 stages of accessories. Lightly used. Giving away to help another family.',
     'Lovevery', 'Play Gym', 2023, 'good', ARRAY['0-3mo','3-6mo'],
     0, TRUE, 'USD', 'Brickell', '33130',
     ST_SetSRID(ST_MakePoint(-80.1900, 25.7600), 4326)::geography) RETURNING id INTO v_id_activity;

  INSERT INTO gear_listings (seller_id, category, subcategory, title, description, brand, model, year_manufactured, condition, age_tags, price_cents, is_free, currency, pickup_city, pickup_zip, location) VALUES
    (v_seller, 'clothing', 'bundle',
     'Baby clothes bundle — 6-9mo neutral (20+ pieces)',
     'Mostly H&M, Gap Baby, Carter''s. Onesies, rompers, sleepers, a few outerwear pieces. Gender-neutral palette.',
     NULL, NULL, NULL, 'good', ARRAY['6-12mo'],
     4500, FALSE, 'USD', 'South Miami', '33143',
     ST_SetSRID(ST_MakePoint(-80.2939, 25.7076), 4326)::geography) RETURNING id INTO v_id_clothing;

  INSERT INTO gear_listing_images (listing_id, image_url, sort_order) VALUES
    (v_id_stroller,  'https://images.unsplash.com/photo-1556484687-30636164638b?w=900', 0),
    (v_id_highchair, 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=900', 0),
    (v_id_carrier,   'https://images.unsplash.com/photo-1604468541196-f8cffdff1eb0?w=900', 0),
    (v_id_toy,       'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=900', 0),
    (v_id_activity,  'https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=900', 0),
    (v_id_clothing,  'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=900', 0);
END $$;
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
    RAISE EXCEPTION 'No user found — sign up in the app first.';
  END IF;

  INSERT INTO gear_listings (seller_id, category, subcategory, title, description, brand, model, year_manufactured, condition, age_tags, price_cents, is_free, currency, pickup_city, pickup_zip, location) VALUES
    (v_seller, 'stroller', 'lightweight',
     'UPPAbaby Minu V2 stroller — excellent condition',
     'Travel stroller used for 8 months, kept indoors. Folds to carry-on size. Includes rain cover and cup holder. Non-smoking home, no pets.',
     'UPPAbaby', 'Minu V2', 2023, 'like_new', ARRAY['3-6mo','6-12mo','12mo+'],
     29900, FALSE, 'USD', 'Miami', '33131',
     ST_SetSRID(ST_MakePoint(-80.1918, 25.7617), 4326)::geography) RETURNING id INTO v_id_stroller;

  INSERT INTO gear_listings (seller_id, category, subcategory, title, description, brand, model, year_manufactured, condition, age_tags, price_cents, is_free, currency, pickup_city, pickup_zip, location) VALUES
    (v_seller, 'high_chair', 'convertible',
     'Stokke Tripp Trapp high chair + baby set',
     'Natural beech wood Tripp Trapp with the Baby Set attachment. Grows from 6mo to teenage. Dismantles flat for pickup.',
     'Stokke', 'Tripp Trapp', 2022, 'good', ARRAY['6-12mo','12mo+'],
     18000, FALSE, 'USD', 'Coral Gables', '33134',
     ST_SetSRID(ST_MakePoint(-80.2684, 25.7214), 4326)::geography) RETURNING id INTO v_id_highchair;

  INSERT INTO gear_listings (seller_id, category, subcategory, title, description, brand, model, year_manufactured, condition, age_tags, price_cents, is_free, currency, pickup_city, pickup_zip, location) VALUES
    (v_seller, 'carrier_wrap', 'structured',
     'Ergobaby Omni 360 carrier — like new',
     'Used a handful of times. All four carry positions. Machine washable. Includes the infant insert.',
     'Ergobaby', 'Omni 360', 2024, 'like_new', ARRAY['0-3mo','3-6mo','6-12mo'],
     7500, FALSE, 'USD', 'Miami Beach', '33139',
     ST_SetSRID(ST_MakePoint(-80.1300, 25.7907), 4326)::geography) RETURNING id INTO v_id_carrier;

  INSERT INTO gear_listings (seller_id, category, subcategory, title, description, brand, model, year_manufactured, condition, age_tags, price_cents, is_free, currency, pickup_city, pickup_zip, location) VALUES
    (v_seller, 'toy', 'wooden',
     'Melissa & Doug wooden puzzle bundle (4 puzzles)',
     'Chunky wooden peg puzzles — farm, zoo, numbers, letters. Wiped down. All pieces present.',
     'Melissa & Doug', NULL, 2022, 'good', ARRAY['12mo+'],
     2500, FALSE, 'USD', 'Coconut Grove', '33133',
     ST_SetSRID(ST_MakePoint(-80.2434, 25.7282), 4326)::geography) RETURNING id INTO v_id_toy;

  INSERT INTO gear_listings (seller_id, category, subcategory, title, description, brand, model, year_manufactured, condition, age_tags, price_cents, is_free, currency, pickup_city, pickup_zip, location) VALUES
    (v_seller, 'activity_center', 'playmat',
     'Lovevery Play Gym — free to a good home',
     'Complete gym with all 5 stages of accessories. Lightly used. Giving away to help another family.',
     'Lovevery', 'Play Gym', 2023, 'good', ARRAY['0-3mo','3-6mo'],
     0, TRUE, 'USD', 'Brickell', '33130',
     ST_SetSRID(ST_MakePoint(-80.1900, 25.7600), 4326)::geography) RETURNING id INTO v_id_activity;

  INSERT INTO gear_listings (seller_id, category, subcategory, title, description, brand, model, year_manufactured, condition, age_tags, price_cents, is_free, currency, pickup_city, pickup_zip, location) VALUES
    (v_seller, 'clothing', 'bundle',
     'Baby clothes bundle — 6-9mo neutral (20+ pieces)',
     'Mostly H&M, Gap Baby, Carter''s. Onesies, rompers, sleepers, a few outerwear pieces. Gender-neutral palette.',
     NULL, NULL, NULL, 'good', ARRAY['6-12mo'],
     4500, FALSE, 'USD', 'South Miami', '33143',
     ST_SetSRID(ST_MakePoint(-80.2939, 25.7076), 4326)::geography) RETURNING id INTO v_id_clothing;

  INSERT INTO gear_listing_images (listing_id, image_url, sort_order) VALUES
    (v_id_stroller,  'https://images.unsplash.com/photo-1556484687-30636164638b?w=900', 0),
    (v_id_highchair, 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=900', 0),
    (v_id_carrier,   'https://images.unsplash.com/photo-1604468541196-f8cffdff1eb0?w=900', 0),
    (v_id_toy,       'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=900', 0),
    (v_id_activity,  'https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=900', 0),
    (v_id_clothing,  'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=900', 0);
END $$;