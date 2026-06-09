-- 079_v4_real_product_screenshots.sql
-- Swap the Villie Picks + the seed "Lovevery Play Gym" gear listing over to real
-- product screenshots the founder captured (clean white-background catalog shots),
-- now hosted in Supabase Storage (gear-listings/seed/picks/*.png, public bucket).
-- Replaces the stand-in Open Library / Unsplash photos from migrations 076 + 078
-- with the actual products so Picks + the free-gym listing read like a real catalog.

-- ── Villie Picks — match by exact name (set in the G3/picks seed) ───────────────
UPDATE public.villie_picks
SET image_url = 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/picks/goodnight-moon.png'
WHERE name = 'Goodnight Moon';

UPDATE public.villie_picks
SET image_url = 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/picks/play-gym.png'
WHERE name = 'Lovevery play gym';

UPDATE public.villie_picks
SET image_url = 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/picks/first-spoons.png'
WHERE name = 'First-spoons set';

UPDATE public.villie_picks
SET image_url = 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/picks/hooded-towels.png'
WHERE name = 'Hooded baby towels';

-- ── Gear listing — the free Lovevery Play Gym's cover image ─────────────────────
-- Update only the cover (lowest sort_order) image for that listing, regardless of
-- whatever placeholder URL it currently holds, so re-running stays correct.
UPDATE public.gear_listing_images gi
SET image_url = 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/gear-listings/seed/picks/play-gym.png'
WHERE gi.listing_id = (
        SELECT id FROM public.gear_listings
        WHERE title = 'Lovevery Play Gym — free to a good home'
        LIMIT 1
      )
  AND gi.sort_order = (
        SELECT MIN(sort_order) FROM public.gear_listing_images
        WHERE listing_id = (
          SELECT id FROM public.gear_listings
          WHERE title = 'Lovevery Play Gym — free to a good home'
          LIMIT 1
        )
      );
