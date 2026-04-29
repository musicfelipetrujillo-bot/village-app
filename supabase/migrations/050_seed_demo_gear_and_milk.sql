-- Production-safe demo seed for V4 Gear + V2 Milk verticals.
--
-- IMPORTANT: this migration was rewritten on 2026-04-28 to be safe for
-- production. The earlier version picked the 3 oldest auth.users and attached
-- "Maria/Sofia/Camila" donor personas to them — fine for local dev (where
-- those users are also developer-owned test accounts) but unacceptable on
-- hosted, where applying it would label real signups as donors.
--
-- New behavior:
--   1. Gear listings (8 items) — seller resolves to Feli (preferred) or the
--      oldest auth.user. Idempotent on title. Safe for production: a single
--      seller account carrying 8 cosmetic listings is acceptable.
--   2. Milk donors (3 profiles) — backed by 3 *fictional* auth.users with
--      synthetic @village.demo emails and never-valid encrypted_password
--      hashes (no one can ever sign in as them). Deterministic UUIDs so
--      re-runs are no-ops. The on_auth_user_created trigger (migration 044)
--      mirrors them into public.users automatically.
--
-- Idempotent throughout: ON CONFLICT DO NOTHING on auth.users + WHERE NOT
-- EXISTS guards on every domain insert. Safe to run multiple times.

DO $$
DECLARE
  v_seller       UUID;
  v_donor1_uid   UUID := '00000000-0000-0000-0000-0000000d0001';
  v_donor2_uid   UUID := '00000000-0000-0000-0000-0000000d0002';
  v_donor3_uid   UUID := '00000000-0000-0000-0000-0000000d0003';
  v_donor1_pid   UUID;
  v_donor2_pid   UUID;
  v_donor3_pid   UUID;
BEGIN
  -- Pick a seller for gear listings (prefer Feli, fall back to oldest user).
  SELECT id INTO v_seller FROM auth.users WHERE email = 'felitrujillo95@hotmail.com' LIMIT 1;
  IF v_seller IS NULL THEN
    SELECT id INTO v_seller FROM auth.users
      WHERE id NOT IN (v_donor1_uid, v_donor2_uid, v_donor3_uid)
      ORDER BY created_at LIMIT 1;
  END IF;
  IF v_seller IS NULL THEN
    RAISE NOTICE 'No real auth.users found — skipping gear seed';
  END IF;

  -- ============================================================
  -- GEAR LISTINGS — 8 Miami-area items under v_seller
  -- age_tags vocab matches events: {pregnancy, 0-3mo, 3-6mo, 6-12mo, 12mo+}
  -- ============================================================
  IF v_seller IS NOT NULL THEN
    INSERT INTO gear_listings (
      seller_id, category, subcategory, title, description, brand, model,
      year_manufactured, condition, age_tags, price_cents, is_free,
      pickup_city, pickup_zip, location, status
    )
    SELECT * FROM (VALUES
      (v_seller, 'stroller', 'travel_stroller',
       'UPPAbaby Minu V2 Stroller',
       'Lightweight travel stroller, used for 6 months. One-hand fold, fits in airplane overhead. Includes rain shield and bumper bar. Smoke-free home.',
       'UPPAbaby', 'Minu V2',
       2024, 'like_new', ARRAY['0-3mo','3-6mo','6-12mo','12mo+']::TEXT[], 28000, FALSE,
       'Miami', '33139', ST_SetSRID(ST_MakePoint(-80.1300, 25.7907), 4326)::geography, 'active'),

      (v_seller, 'high_chair', 'convertible_high_chair',
       'Stokke Tripp Trapp High Chair',
       'Iconic Norwegian wooden high chair in walnut. Grows with baby from 6 months through adulthood. Includes baby set and harness. Light wear on tray.',
       'Stokke', 'Tripp Trapp',
       2022, 'good', ARRAY['6-12mo','12mo+']::TEXT[], 18000, FALSE,
       'Coral Gables', '33134', ST_SetSRID(ST_MakePoint(-80.2683, 25.7215), 4326)::geography, 'active'),

      (v_seller, 'carrier_wrap', 'soft_structured_carrier',
       'Ergobaby Omni 360 Carrier',
       'Four-position carrier (front inward, front outward, hip, back). Newborn-ready, no insert needed. Mesh fabric for Miami heat. Washed gently.',
       'Ergobaby', 'Omni 360 Cool Air Mesh',
       2023, 'good', ARRAY['0-3mo','3-6mo','6-12mo','12mo+']::TEXT[], 8500, FALSE,
       'Miami', '33131', ST_SetSRID(ST_MakePoint(-80.1918, 25.7634), 4326)::geography, 'active'),

      (v_seller, 'activity_center', 'play_gym',
       'Lovevery Play Gym (FREE)',
       'Original Lovevery Play Gym with all 5 development zones. Our baby outgrew it. Free to a good home — just pickup.',
       'Lovevery', 'The Play Gym',
       2023, 'good', ARRAY['0-3mo','3-6mo']::TEXT[], 0, TRUE,
       'Miami Beach', '33140', ST_SetSRID(ST_MakePoint(-80.1300, 25.8121), 4326)::geography, 'active'),

      (v_seller, 'toy', 'puzzle',
       'Melissa & Doug Wooden Puzzle Bundle (3 puzzles)',
       'Set of three chunky wooden puzzles — animals, vehicles, shapes. All pieces accounted for. Perfect for 18m–3yr.',
       'Melissa & Doug', 'Chunky Puzzle Set',
       2023, 'like_new', ARRAY['12mo+']::TEXT[], 2500, FALSE,
       'Miami', '33133', ST_SetSRID(ST_MakePoint(-80.2422, 25.7282), 4326)::geography, 'active'),

      (v_seller, 'feeding_gear', 'bottle',
       'Comotomo Baby Bottles (5oz, set of 4)',
       'Silicone bottles, slow-flow nipples. Used for 3 months before baby preferred the breast. Sterilized and stored.',
       'Comotomo', 'Natural Feel 5oz',
       2024, 'like_new', ARRAY['0-3mo','3-6mo']::TEXT[], 2000, FALSE,
       'Miami', '33127', ST_SetSRID(ST_MakePoint(-80.1989, 25.8011), 4326)::geography, 'active'),

      (v_seller, 'bouncer_swing', 'powered_swing',
       '4moms MamaRoo 4 Bouncer',
       'Battery + plug bouncer with 5 motions and 5 speeds. Bluetooth-enabled. Saved our sanity in the newborn weeks. Cover machine-washable.',
       '4moms', 'MamaRoo 4',
       2023, 'good', ARRAY['0-3mo','3-6mo']::TEXT[], 12000, FALSE,
       'Miami', '33137', ST_SetSRID(ST_MakePoint(-80.1879, 25.8089), 4326)::geography, 'active'),

      (v_seller, 'clothing', 'outfit_bundle',
       'Baby Clothes Bundle 0–3mo (12 pieces)',
       'Mix of onesies, sleepers, and outfits. Brands: Carter''s, Gerber, H&M. All washed in Dreft. Excellent condition.',
       'Carter''s', 'Mixed',
       NULL::INTEGER, 'good', ARRAY['0-3mo']::TEXT[], 3000, FALSE,
       'Miami', '33138', ST_SetSRID(ST_MakePoint(-80.1885, 25.8231), 4326)::geography, 'active')
    ) AS new_listings(
      seller_id, category, subcategory, title, description, brand, model,
      year_manufactured, condition, age_tags, price_cents, is_free,
      pickup_city, pickup_zip, location, status
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM gear_listings WHERE gear_listings.title = new_listings.title
    );
  END IF;

  -- ============================================================
  -- FICTIONAL DONOR USERS — 3 demo accounts in auth.users
  -- - Synthetic @village.demo emails (RFC-2606-style reserved-style domain).
  -- - encrypted_password set to a never-valid bcrypt hash so no one can sign
  --   in as these accounts even with the email.
  -- - email_confirmed_at + confirmed_at set so they pass any "active" checks.
  -- - is_sso_user / is_anonymous default to false (NOT NULL).
  -- - on_auth_user_created trigger (migration 044) auto-mirrors them into
  --   public.users; no manual public.users insert needed.
  -- - ON CONFLICT (id) DO NOTHING for idempotency on re-runs.
  -- ============================================================
  -- Note: auth.users.confirmed_at is a GENERATED column on Supabase hosted
  -- (derived from email_confirmed_at + phone_confirmed_at), so we never
  -- insert it directly — Postgres will compute it from email_confirmed_at.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    is_super_admin, is_sso_user, is_anonymous
  )
  VALUES
    ('00000000-0000-0000-0000-000000000000', v_donor1_uid,
     'authenticated', 'authenticated', 'demo-donor-1@village.demo',
     '$2a$10$DEMOACCOUNTNEVERLOGINxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
     now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Maria (demo donor)"}'::jsonb,
     now(), now(), FALSE, FALSE, FALSE),

    ('00000000-0000-0000-0000-000000000000', v_donor2_uid,
     'authenticated', 'authenticated', 'demo-donor-2@village.demo',
     '$2a$10$DEMOACCOUNTNEVERLOGINxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
     now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Sofia (demo donor)"}'::jsonb,
     now(), now(), FALSE, FALSE, FALSE),

    ('00000000-0000-0000-0000-000000000000', v_donor3_uid,
     'authenticated', 'authenticated', 'demo-donor-3@village.demo',
     '$2a$10$DEMOACCOUNTNEVERLOGINxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
     now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Camila (demo donor)"}'::jsonb,
     now(), now(), FALSE, FALSE, FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- DONOR PROFILES + LISTINGS — one per fictional user
  -- Idempotent via NOT EXISTS guards on user_id.
  -- ============================================================

  -- Donor 1 — Brickell
  INSERT INTO milk_donor_profiles (
    user_id, display_name, bio, neighborhood, city, state, zip_code, lat, lng,
    price_per_oz, supply_oz_available, is_active, is_verified,
    stripe_onboarding_complete
  )
  SELECT
    v_donor1_uid, 'Maria · Brickell',
    'Full-term mom of two, oversupplier since week 4. Vegetarian, no caffeine. Happy to chat about feeding schedules.',
    'Brickell', 'Miami', 'FL', '33131', 25.7634, -80.1918,
    2.00, 200, TRUE, TRUE, TRUE
  WHERE NOT EXISTS (SELECT 1 FROM milk_donor_profiles WHERE user_id = v_donor1_uid);

  SELECT id INTO v_donor1_pid FROM milk_donor_profiles WHERE user_id = v_donor1_uid;
  IF v_donor1_pid IS NOT NULL THEN
    INSERT INTO milk_listings (
      donor_profile_id, oz_available, price_per_oz, min_order_oz,
      pickup_available, shipping_available, status, notes
    )
    SELECT
      v_donor1_pid, 200, 2.00, 8,
      TRUE, FALSE, 'active', 'Pickup in Brickell, evenings + weekends.'
    WHERE NOT EXISTS (
      SELECT 1 FROM milk_listings
      WHERE donor_profile_id = v_donor1_pid AND status = 'active'
    );
  END IF;

  -- Donor 2 — Coral Gables
  INSERT INTO milk_donor_profiles (
    user_id, display_name, bio, neighborhood, city, state, zip_code, lat, lng,
    price_per_oz, supply_oz_available, is_active, is_verified,
    stripe_onboarding_complete
  )
  SELECT
    v_donor2_uid, 'Sofia · Coral Gables',
    'First-time mom, 3 months postpartum. Organic diet, no dairy. Freezer stash growing — ready to share.',
    'Coral Gables', 'Coral Gables', 'FL', '33134', 25.7215, -80.2683,
    2.50, 120, TRUE, FALSE, TRUE
  WHERE NOT EXISTS (SELECT 1 FROM milk_donor_profiles WHERE user_id = v_donor2_uid);

  SELECT id INTO v_donor2_pid FROM milk_donor_profiles WHERE user_id = v_donor2_uid;
  IF v_donor2_pid IS NOT NULL THEN
    INSERT INTO milk_listings (
      donor_profile_id, oz_available, price_per_oz, min_order_oz,
      pickup_available, shipping_available, shipping_price, status, notes
    )
    SELECT
      v_donor2_pid, 120, 2.50, 8,
      TRUE, TRUE, 18.00, 'active',
      'Frozen 4oz pouches, dated. Pickup or overnight ship in dry ice.'
    WHERE NOT EXISTS (
      SELECT 1 FROM milk_listings
      WHERE donor_profile_id = v_donor2_pid AND status = 'active'
    );
  END IF;

  -- Donor 3 — Wynwood
  INSERT INTO milk_donor_profiles (
    user_id, display_name, bio, neighborhood, city, state, zip_code, lat, lng,
    price_per_oz, supply_oz_available, is_active, is_verified,
    stripe_onboarding_complete
  )
  SELECT
    v_donor3_uid, 'Camila · Wynwood',
    'Two under two — donating extra supply to local moms. Gluten-free. Local pickup preferred.',
    'Wynwood', 'Miami', 'FL', '33127', 25.8011, -80.1989,
    1.75, 80, TRUE, FALSE, FALSE
  WHERE NOT EXISTS (SELECT 1 FROM milk_donor_profiles WHERE user_id = v_donor3_uid);

  SELECT id INTO v_donor3_pid FROM milk_donor_profiles WHERE user_id = v_donor3_uid;
  IF v_donor3_pid IS NOT NULL THEN
    INSERT INTO milk_listings (
      donor_profile_id, oz_available, price_per_oz, min_order_oz,
      pickup_available, shipping_available, status, notes
    )
    SELECT
      v_donor3_pid, 80, 1.75, 4,
      TRUE, FALSE, 'active', 'Local pickup only, weekday afternoons.'
    WHERE NOT EXISTS (
      SELECT 1 FROM milk_listings
      WHERE donor_profile_id = v_donor3_pid AND status = 'active'
    );
  END IF;
END $$;
