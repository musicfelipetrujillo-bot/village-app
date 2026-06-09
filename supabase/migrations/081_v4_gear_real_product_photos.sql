-- 081_v4_gear_real_product_photos.sql
-- Swap the remaining 4 seed gear listing covers (stroller, carrier, high chair,
-- wooden puzzle) over to the founder's real product screenshots, now hosted in
-- Supabase Storage (gear-listings/seed/gear/*.png, public bucket). Companion to
-- 080 (play gym). Matched by brand + category (robust + portable — the hosted
-- titles differ from the web-dev seed strings), updating only the cover image
-- (lowest sort_order) so re-running stays correct and never clobbers extra angles.
-- Note: migration 078's URL-fragment matching never hit these hosted seed rows
-- (the fragments referenced web-seed URLs), so the covers were still the original
-- 012 Unsplash photos until now.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('UPPAbaby',      'stroller',     'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/gear/stroller.png'),
      ('Ergobaby',      'carrier_wrap', 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/gear/carrier.png'),
      ('Stokke',        'high_chair',   'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/gear/high-chair.png'),
      ('Melissa & Doug','toy',          'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/gear/puzzles.png')
    ) AS t(brand, category, url)
  LOOP
    UPDATE public.gear_listing_images gi
    SET image_url = r.url
    WHERE gi.listing_id IN (
            SELECT id FROM public.gear_listings
            WHERE brand = r.brand AND category = r.category
          )
      AND gi.sort_order = (
            SELECT MIN(sort_order) FROM public.gear_listing_images gi2
            WHERE gi2.listing_id = gi.listing_id
          );
  END LOOP;
END $$;
