-- 078_v4_gear_product_photos.sql
-- Upgrade the seed gear listing photos to more product-forward shots (full
-- item visible) so the Baby Gear browse reads like a real marketplace rather
-- than lifestyle snapshots. Matches each existing image by its current URL
-- fragment → new free-license Unsplash photo. Placeholders pending partner /
-- seller / Storage-hosted product photography.

-- Stroller (was a beach lifestyle shot)
UPDATE public.gear_listing_images
SET image_url = 'https://images.unsplash.com/photo-1714392512700-4cab9e51710b?w=900&q=70&fit=crop'
WHERE image_url LIKE '%photo-1556484687-30636164638b%';

-- High chair → clean studio-style shot
UPDATE public.gear_listing_images
SET image_url = 'https://images.unsplash.com/photo-1728473185541-a1b3cfd86c0d?w=900&q=70&fit=crop'
WHERE image_url LIKE '%photo-1515488764276-beab7607c1e6%';

-- Carrier → the carrier as the clear subject (was a dark back-wrap / dead URL)
UPDATE public.gear_listing_images
SET image_url = 'https://images.unsplash.com/photo-1729356650188-c89c401ebc48?w=900&q=70&fit=crop'
WHERE image_url LIKE '%photo-1604468541196-f8cffdff1eb0%'
   OR image_url LIKE '%photo-1685633224499-dd3759500e8f%';

-- Wooden toy → clean stacking-toy product shot
UPDATE public.gear_listing_images
SET image_url = 'https://images.unsplash.com/photo-1618842676088-c4d48a6a7c9d?w=900&q=70&fit=crop'
WHERE image_url LIKE '%photo-1516627145497-ae6968895b74%';

-- Play gym → the full wooden gym arch visible
UPDATE public.gear_listing_images
SET image_url = 'https://images.unsplash.com/photo-1648159643766-1ba916a2bccf?w=900&q=70&fit=crop'
WHERE image_url LIKE '%photo-1566140967404-b8b3932483f5%';
