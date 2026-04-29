-- Local development seed.
-- Runs automatically on `supabase db reset`.
--
-- Note: Postgres GUCs (`app.supabase_url`, `app.service_role_key`) cannot be
-- set from this file because seed.sql runs as the `postgres` role, which is
-- NOT a superuser in Supabase local — only `supabase_admin` is. ALTER DATABASE
-- requires superuser privileges.
--
-- Run `scripts/setup-local-gucs.sh` once after `supabase start` to set them.
-- See docs/PRE_LAUNCH_RUNBOOK.md §2.3 for production setup.

-- ============================================================================
-- V1 Specialist Directory — Miami seed data
-- Source: docs/source/Miami_Specialist_Directory.md
--
-- Why seed (vs migration): this is sample data scoped to local dev and staging
-- resets. Production gets the real specialists via the admin flow, not this
-- file. `supabase db reset` wipes the DB, so seed.sql is re-run; everything
-- below is idempotent via ON CONFLICT.
--
-- NPI numbers: placeholders (1000000001+). npi_verified stays FALSE so the
-- NPI badge doesn't falsely claim real-world verification. Real launch data
-- will go through npi-verify Edge Function.
--
-- admin_approved = TRUE so these rows are visible via RLS (added in
-- migration 013). Without this flag, the Experts tab list is empty.
--
-- Lat/lng: approximate neighborhood centroids (Coral Gables, Hialeah,
-- Kendall, Miami Beach, North Miami Beach). Good enough for `specialists_near`
-- RPC exercising geo distance sort.
-- ============================================================================

-- OB/GYN
INSERT INTO specialists (npi_number, full_name, credentials, specialty, bio, practice_name, city, state, zip_code, lat, lng, website_url, telehealth_available, accepting_patients, years_experience, admin_approved)
VALUES
  ('1000000001', 'Dr. Andrea Faraci', 'MD', 'ob_gyn',
   'Full obstetric & gynecologic care serving Hialeah & North Miami communities. Bilingual English/Spanish practice covering prenatal, labor & delivery.',
   'Andrea Faraci MD', 'Hialeah', 'FL', '33012', 25.8576, -80.2781,
   'https://www.zocdoc.com/obgyns/miami-218306pm', FALSE, TRUE, 12, TRUE),
  ('1000000002', 'Dr. Lorena Tinoco', 'MD', 'ob_gyn',
   'Obstetrics, gynecology, menopause and hormone care based in Coral Gables. Fully bilingual English/Spanish; virtual consultations available.',
   'Tinoco MD', 'Coral Gables', 'FL', '33134', 25.7215, -80.2684,
   'https://www.tinocomd.com/', TRUE, TRUE, 15, TRUE),
  ('1000000003', 'Dr. Ilya S. Johnson', 'MD', 'ob_gyn',
   'Baptist Hospital of Miami-affiliated OB/GYN with 35+ years of experience. Full-spectrum prenatal and postnatal care in English and Spanish.',
   'Baptist Health Medical Group', 'Miami', 'FL', '33176', 25.6846, -80.3389,
   'https://doctor.webmd.com/providers/specialty/obstetrics-gynecology/florida/miami', FALSE, TRUE, 35, TRUE),
  ('1000000004', 'South Florida Women''s Care', 'MD Group Practice', 'ob_gyn',
   'Comprehensive OB/GYN group practice in South Miami. Prenatal care plus minimally invasive surgery; telehealth available.',
   'South Florida Women''s Care', 'South Miami', 'FL', '33143', 25.7079, -80.2936,
   'https://obgynmiamifl.com/', TRUE, TRUE, 20, TRUE)
ON CONFLICT (npi_number) DO NOTHING;

-- Midwives
INSERT INTO specialists (npi_number, full_name, credentials, specialty, bio, practice_name, city, state, zip_code, lat, lng, website_url, telehealth_available, accepting_patients, years_experience, admin_approved)
VALUES
  ('1000000005', 'Maternity Options of Miami (MOM)', 'CNM Practice', 'midwife',
   'Certified Nurse-Midwife practice focused on natural and holistic birth, water birth, and home birth support. Telehealth prenatal visits available.',
   'Maternity Options of Miami', 'Miami', 'FL', '33133', 25.7404, -80.2443,
   'https://www.maternityoptionsofmiami.com/services', TRUE, TRUE, 10, TRUE)
ON CONFLICT (npi_number) DO NOTHING;

-- Doulas
INSERT INTO specialists (npi_number, full_name, credentials, specialty, bio, practice_name, city, state, zip_code, lat, lng, phone, website_url, telehealth_available, accepting_patients, years_experience, admin_approved)
VALUES
  ('1000000006', 'Amazing Births & Beyond', 'Certified Doula Agency', 'doula',
   'Birth & postpartum doula agency serving all of South Florida. Includes childbirth education and newborn care; virtual support available.',
   'Amazing Births & Beyond', 'North Miami Beach', 'FL', '33160', 25.9331, -80.1628,
   '+17869556560', 'https://amazingbirthsandbeyond.com/', TRUE, TRUE, 8, TRUE),
  ('1000000007', 'Milly Gomez', 'Certified Doula', 'doula',
   'Birth & postpartum doula offering continuous labor support, postpartum visits, newborn guidance, and breastfeeding basics. Fully bilingual.',
   'Born Bir · Milly Gomez', 'Miami', 'FL', '33130', 25.7656, -80.1917,
   NULL, 'https://www.bornbir.com/milly-gomez', TRUE, TRUE, 6, TRUE),
  ('1000000008', 'First Class Doulas', 'Certified Doula Team', 'doula',
   'Certified doula team covering Miami-Dade, Broward, and Palm Beach. Culturally sensitive care including bereavement support.',
   'First Class Doulas', 'Miami', 'FL', '33131', 25.7670, -80.1862,
   NULL, 'https://firstclassdoulas.com/', TRUE, TRUE, 10, TRUE),
  ('1000000009', 'Mother Retreat', 'Doula Service', 'doula',
   'Birth and postpartum doula service with labor support, postpartum care, newborn classes, and sleep guidance. Online support packages available.',
   'Mother Retreat', 'Miami', 'FL', '33130', 25.7656, -80.1917,
   NULL, 'https://motheretreat.com/', TRUE, TRUE, 7, TRUE)
ON CONFLICT (npi_number) DO NOTHING;

-- Lactation consultants
INSERT INTO specialists (npi_number, full_name, credentials, specialty, bio, practice_name, city, state, zip_code, lat, lng, website_url, telehealth_available, accepting_patients, years_experience, admin_approved)
VALUES
  ('1000000010', 'Thrive Lactation Center', 'IBCLC', 'lactation_consultant',
   'IBCLC-staffed lactation center covering Miami and South Florida. Breastfeeding assessment, latch help, supply support, pumping, and prenatal classes.',
   'Thrive Lactation Center', 'Miami', 'FL', '33137', 25.8103, -80.1928,
   'https://www.thrivelactationcenter.com/miami-lactation-consultant', TRUE, TRUE, 9, TRUE),
  ('1000000011', 'The Milk Collective', 'IBCLC', 'lactation_consultant',
   'In-home and virtual breastfeeding support, tongue-tie assessment, and weaning guidance across Miami and Fort Lauderdale.',
   'The Milk Collective', 'Miami', 'FL', '33137', 25.8103, -80.1928,
   'https://www.themilkcollective.co/', TRUE, TRUE, 7, TRUE),
  ('1000000012', 'Marina Langesfeld', 'IBCLC', 'lactation_consultant',
   'Board Certified Lactation Consultant affiliated with Hialeah Hospital. Breastfeeding education, childbirth classes, hospital-based and outpatient consults.',
   'Marina Langesfeld IBCLC', 'North Miami Beach', 'FL', '33162', 25.9295, -80.1718,
   'https://motherfigure.com/directory/lactation-consultant/marina-langesfeld/', FALSE, TRUE, 14, TRUE),
  ('1000000013', 'Mariela', 'Certified Doula & IBCLC', 'lactation_consultant',
   'Lactation consultant and doula with 17 years of experience serving Miami-Dade & Broward. Trilingual (English, Spanish, Portuguese).',
   'Born Bir · Mariela', 'Miami', 'FL', '33130', 25.7656, -80.1917,
   'https://www.bornbir.com/miami/fl/lactation_consultant', TRUE, TRUE, 17, TRUE),
  ('1000000014', 'Baby 2 Breast', 'IBCLC', 'lactation_consultant',
   'In-home & virtual lactation services including prenatal breastfeeding prep and NICU support. Virtual consultations are the main offering.',
   'Baby 2 Breast', 'Miami', 'FL', '33137', 25.8103, -80.1928,
   'https://www.baby2breast.net/', TRUE, TRUE, 11, TRUE)
ON CONFLICT (npi_number) DO NOTHING;

-- Pediatricians
INSERT INTO specialists (npi_number, full_name, credentials, specialty, bio, practice_name, address_line1, city, state, zip_code, lat, lng, phone, website_url, telehealth_available, accepting_patients, years_experience, admin_approved)
VALUES
  ('1000000015', 'Dr. Rozalyn Paschal', 'MD', 'pediatrician',
   'Board-certified pediatrician specializing in newborn telehealth. Same-day appointments, Medicaid accepted; bilingual staff.',
   'R.H. Paschal MD', '7900 NW 27th Ave, Suite 50', 'Miami', 'FL', '33147', 25.8261, -80.2511,
   '+13057580591', 'https://rhpaschalmd.com/', TRUE, TRUE, 18, TRUE),
  ('1000000016', 'Dr. Pilar Delgado', 'MD', 'pediatrician',
   'Board-certified pediatrician with Bluebird Kids Health. Fully bilingual well-baby visits and developmental screenings; telehealth available.',
   'Bluebird Kids Health', NULL, 'Miami', 'FL', '33176', 25.6846, -80.3389,
   NULL, 'https://www.zocdoc.com/pediatricians/miami-218306pm', TRUE, TRUE, 12, TRUE),
  ('1000000017', 'Pediatric Associates — Miami Beach', 'Pediatric Group', 'pediatrician',
   'Pediatric group practice covering newborn care, immunizations, well-child and sick visits, and developmental evaluations.',
   'Pediatric Associates', NULL, 'Miami Beach', 'FL', '33140', 25.8160, -80.1284,
   NULL, 'https://www.pediatricassociates.com/pediatric-office/miami-beach-fl-mid-beach', TRUE, TRUE, 25, TRUE)
ON CONFLICT (npi_number) DO NOTHING;

-- Languages: every seeded specialist offers English + Spanish per source doc.
-- Mariela additionally offers Portuguese.
INSERT INTO specialist_languages (specialist_id, language_code)
SELECT s.id, lang.code
FROM specialists s
CROSS JOIN (VALUES ('en'), ('es')) AS lang(code)
WHERE s.npi_number BETWEEN '1000000001' AND '1000000017'
ON CONFLICT (specialist_id, language_code) DO NOTHING;

INSERT INTO specialist_languages (specialist_id, language_code)
SELECT s.id, 'pt'
FROM specialists s
WHERE s.npi_number = '1000000013'
ON CONFLICT (specialist_id, language_code) DO NOTHING;

-- ============================================================================
-- Local dev test user — rey@village.test / village12345
--
-- Why seed an auth user:
--   `supabase db reset` wipes auth.users, so any account created via signup is
--   gone after each reset. Hospital-discharge GTM means we test the WeeklyJourney
--   + Home flow constantly — having a known account with a baby profile pinned
--   to a specific postpartum week is far cheaper than re-onboarding every reset.
--
-- Stable user id (UUID) is used directly so we can join public.users +
-- baby_profiles to the same auth.users row deterministically across resets.
-- bcrypt hash is generated on the fly via crypt() so the source file never
-- ships a pre-baked hash.
--
-- DO NOT seed test users in production. This file runs locally on db reset.
-- ============================================================================

-- NOTE: confirmation_token / recovery_token / email_change_token_* /
-- phone_change_token / reauthentication_token MUST be inserted as '' (empty
-- string), NOT left to default. Recent GoTrue versions scan these columns as
-- Go strings and raise "converting NULL to string is unsupported" → surfaces
-- to the client as "Database error querying schema" on /token. The columns
-- are nullable at the schema level but GoTrue treats them as NOT NULL.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone_change, phone_change_token,
  reauthentication_token
) VALUES (
  'c16f69ae-445d-4348-83f0-592605f6ec37',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'rey@village.test',
  crypt('village12345', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  NOW(),
  NOW(),
  '', '', '', '', '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

-- auth.identities row is required for Supabase email/password sign-in to work.
-- Without it the GoTrue server returns "invalid login credentials" even with a
-- matching auth.users row.
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  created_at, updated_at, last_sign_in_at
) VALUES (
  gen_random_uuid(),
  'c16f69ae-445d-4348-83f0-592605f6ec37',
  'rey@village.test',
  jsonb_build_object('sub', 'c16f69ae-445d-4348-83f0-592605f6ec37', 'email', 'rey@village.test'),
  'email',
  NOW(), NOW(), NOW()
)
ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO public.users (id, email, full_name, pregnancy_stage, preferred_language, zip_code)
VALUES (
  'c16f69ae-445d-4348-83f0-592605f6ec37',
  'rey@village.test',
  'Rey Tester',
  'postpartum_0_6mo',
  'en',
  '33101'
)
ON CONFLICT (id) DO NOTHING;

-- Baby profile pinned to week 6 — that's the most content-rich week (PPD crisis
-- footer, 6-week postpartum visit checklist as `is_essential=TRUE`, pelvic
-- floor PT village_support deeplink). Date is computed off CURRENT_DATE so the
-- "current_week_number" generated column always reads 6 regardless of when the
-- reset is run.
INSERT INTO public.baby_profiles (
  user_id, baby_name, date_of_birth, is_premature, gender, feeding_method
) VALUES (
  'c16f69ae-445d-4348-83f0-592605f6ec37',
  'Lumi',
  (CURRENT_DATE - INTERVAL '36 days')::date,
  FALSE,
  'unknown',
  'breastfed'
)
ON CONFLICT (user_id) DO UPDATE SET
  date_of_birth = EXCLUDED.date_of_birth;

