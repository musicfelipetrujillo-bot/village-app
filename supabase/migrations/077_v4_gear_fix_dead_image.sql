-- 077_v4_gear_fix_dead_image.sql
-- The Ergobaby carrier seed listing's cover image (set in migration 012)
-- 404s now (the old Unsplash photo was removed). Repoint it to a working,
-- free-license carrier photo so the Baby Gear browse looks complete on native.
-- (The other 5 seed listing images still resolve.) Placeholder pending
-- partner / Storage-hosted assets.
UPDATE public.gear_listing_images
SET image_url = 'https://images.unsplash.com/photo-1685633224499-dd3759500e8f?w=900&q=70&fit=crop'
WHERE image_url LIKE '%photo-1604468541196-f8cffdff1eb0%';
