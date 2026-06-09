-- 080_v4_gear_playgym_real_photo.sql
-- Follow-up to 079: the seed Lovevery Play Gym listing's real hosted title is
-- "Lovevery Play Gym (FREE)" (not the web-dev-seed string used in 079), so 079's
-- title match was a no-op for the gear cover. Migration 078's play-gym fragment
-- also missed it (the hosted cover was still the original 012 Unsplash photo).
-- Repoint the cover to the founder's real product screenshot, matched robustly by
-- brand + category (the free Lovevery activity-center listing) so it can't drift.
UPDATE public.gear_listing_images gi
SET image_url = 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/picks/play-gym.png'
WHERE gi.listing_id IN (
        SELECT id FROM public.gear_listings
        WHERE brand = 'Lovevery' AND category = 'activity_center'
      )
  AND gi.sort_order = (
        SELECT MIN(sort_order) FROM public.gear_listing_images gi2
        WHERE gi2.listing_id = gi.listing_id
      );
