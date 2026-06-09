-- 084_v_real_photos_donors_logos.sql
-- Three founder-requested asset updates, all data-only (render code already ships):
--  1. Re-crop Dr. Ana Rodriguez's specialist headshot — the original screenshot had
--     a dark top strip + caption bar that showed as a border in the tile. New
--     versioned file (…-v2) tightens onto the subject (cache-bust via new path).
--  2. Milk Connect donor cards: give the seed donors real-mom photos (the cards +
--     profile already render avatar_url, with an initial fallback for the rest).
--  3. Perks: wire the real Pampers + Nara Organics logos uploaded to Storage
--     (replaces the interim brand-initial badges from migration 083).
-- All assets in the public `avatars` bucket.

-- 1. Specialist — cropped Ana headshot (no border)
UPDATE public.specialists
SET photo_url = 'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/specialists/ana-rodriguez-v2.png'
WHERE full_name = 'Dr. Ana Rodriguez';

-- 2. Milk Connect donors — real-mom avatars (matched by stable id)
UPDATE public.milk_donor_profiles SET avatar_url =
  'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/donors/donor-maria.png'
WHERE id = 'e9c6f494-9194-449c-af9c-1e14102feeb0';   -- Maria · Brickell
UPDATE public.milk_donor_profiles SET avatar_url =
  'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/donors/donor-sofia.png'
WHERE id = '12323693-ca70-473c-a5bc-a46af749d7c4';   -- Sofia · Coral Gables
UPDATE public.milk_donor_profiles SET avatar_url =
  'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/donors/donor-camila.png'
WHERE id = '7478721c-47a0-4ef7-aec2-3f8d4adffa1a';   -- Camila · Wynwood
UPDATE public.milk_donor_profiles SET avatar_url =
  'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/donors/donor-feli.png'
WHERE id = 'ed456c6a-1a19-412a-97b9-5569f02b4e80';   -- Feli

-- 3. Perks — real brand logos
UPDATE public.brand_deals SET brand_logo_url =
  'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/perks/pampers.png'
WHERE brand_name = 'Pampers';
UPDATE public.brand_deals SET brand_logo_url =
  'https://albyndcruwopulazvpjs.supabase.co/storage/v1/object/public/avatars/seed/perks/nara.png'
WHERE brand_name = 'Nara Organics';
