-- Migration 064 · V4 Gear · Stock product reference image
--
-- Adds optional `reference_image_url` to gear_listings — the stock/catalog
-- image returned by Go-UPC or UPCitemdb when a seller scans a UPC during
-- listing creation. Surfaced in GearListingDetailScreen as a small "Product
-- reference" card alongside (NOT replacing) the seller's own photos.
--
-- Posture decision documented in the gear-UX option 2 thread:
--   - User-uploaded photos remain primary (truth-in-listing). They are the
--     actual condition signal a buyer evaluates.
--   - The stock image is labeled "Product reference" so no buyer confuses
--     it with the actual item. Keeps the marketplace-vs-supplier line clean
--     for Section 230 / FDUTPA — we're not supplying the photo as if it
--     were ours, we're surfacing the public product-catalog reference the
--     seller's UPC lookup turned up.
--
-- Companion changes (this migration only handles the DB layer):
--   - apps/mobile/src/api/gear.ts — extends CreateListingInput + the RPC
--     signature + GearListing interface to carry reference_image_url.
--   - apps/mobile/src/screens/gear/CreateListingScreen.tsx — captures the
--     image URL from the UPC lookup response and includes it in the
--     createListing call.
--   - apps/mobile/src/screens/gear/GearListingDetailScreen.tsx — renders a
--     small labeled "Product reference" card if the field is non-null.

ALTER TABLE gear_listings
  ADD COLUMN IF NOT EXISTS reference_image_url TEXT;

COMMENT ON COLUMN gear_listings.reference_image_url IS
  'Optional. Stock/catalog product image URL returned by Go-UPC or UPCitemdb when the seller scanned a UPC during listing creation. Shown in the UI as a separate "Product reference" card so buyers cannot confuse it with the seller''s own condition photos. NULL for listings without a UPC match.';

-- Extend create_gear_listing to accept the new optional param. We add it as
-- a new positional param at the end of the existing signature so any caller
-- that doesn't pass it (e.g. an older mobile build) keeps working — the new
-- column is NULLable so omission is fine.
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
  p_lng DOUBLE PRECISION,
  p_reference_image_url TEXT DEFAULT NULL
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
    pickup_city, pickup_zip, location, reference_image_url
  ) VALUES (
    v_user, p_category, p_subcategory, p_title, p_description, p_brand, p_model,
    p_year_manufactured, p_condition, COALESCE(p_age_tags, '{}'),
    GREATEST(p_price_cents, 0), COALESCE(p_is_free, FALSE),
    p_pickup_city, p_pickup_zip,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_reference_image_url
  ) RETURNING gear_listings.id INTO v_id;

  RETURN QUERY SELECT v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_gear_listing(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT[],
  INTEGER, BOOLEAN, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT
) TO authenticated;
REVOKE EXECUTE ON FUNCTION create_gear_listing(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT[],
  INTEGER, BOOLEAN, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT
) FROM anon;

-- Extend get_gear_listing to return the new column. Migration 023 already
-- added a couple of CPSC fields the same way (multi-step CREATE OR REPLACE)
-- so this is the established pattern.
--
-- We have to redeclare the function with the same signature plus the new
-- column. Drop the old return-type-conflicting version first.
DROP FUNCTION IF EXISTS get_gear_listing(UUID);

-- Return shape mirrors post-023 exactly + reference_image_url appended.
-- Position after `upc` keeps the column adjacent to its semantic neighbor
-- (everything in this group is "metadata learned from the UPC scan").
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
  cpsc_recall_status TEXT, cpsc_recall_id TEXT, cpsc_recall_url TEXT,
  cpsc_checked_at TIMESTAMPTZ,
  upc TEXT,
  reference_image_url TEXT,
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
    l.cpsc_recall_status, l.cpsc_recall_id, l.cpsc_recall_url,
    l.cpsc_checked_at,
    l.upc,
    l.reference_image_url,
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

GRANT EXECUTE ON FUNCTION get_gear_listing(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_gear_listing(UUID) FROM anon;
