-- 082_v1_specialist_real_photos.sql
-- Give the seed specialist directory real headshots (founder-supplied stock
-- portraits) instead of the specialty-emoji fallback tiles. Hosted in Supabase
-- Storage (avatars/seed/specialists/*.png, public bucket). The card + profile
-- both fall back to the emoji when photo_url IS NULL, so the 3 specialists left
-- without a photo here keep rendering cleanly. Placeholder portraits for the
-- pre-launch feel build — swap for real provider-supplied headshots before any
-- public launch (these faces are stock, the names are fictional seed data).

UPDATE public.specialists
SET photo_url = 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/specialists/maria-santos.png'
WHERE full_name = 'Maria Santos';

UPDATE public.specialists
SET photo_url = 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/specialists/ana-rodriguez.png'
WHERE full_name = 'Dr. Ana Rodriguez';

UPDATE public.specialists
SET photo_url = 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/specialists/sarah-mills.png'
WHERE full_name = 'Coach Sarah Mills';

UPDATE public.specialists
SET photo_url = 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/specialists/jennifer-lee.png'
WHERE full_name = 'Dr. Jennifer Lee';
