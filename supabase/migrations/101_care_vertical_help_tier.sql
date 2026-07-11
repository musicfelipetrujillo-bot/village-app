-- Care vertical — Phase 1: non-clinical "extra hands" tier.
--
-- Broadens the specialists directory (now "Care") from clinical-only to two
-- tiers that share one table + the specialists_near RPC:
--   provider_kind = 'clinical' → NPI-verified (existing)
--   provider_kind = 'help'     → background-checked (night nurse, doula, nanny…)
--
-- Pilot-safe: background_checked is a MANUALLY-granted badge here. The real
-- Checkr/Certn integration + provider-pays flow is Phase 4 and ATTORNEY-GATED
-- (childcare = higher liability — see docs/CARE_VERTICAL.md + Risk & Compliance).
--
-- npi_number is already nullable (migration 061), so help providers need no NPI.

ALTER TABLE public.specialists
  ADD COLUMN IF NOT EXISTS provider_kind TEXT NOT NULL DEFAULT 'clinical'
    CHECK (provider_kind IN ('clinical', 'help')),
  ADD COLUMN IF NOT EXISTS background_checked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS background_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hourly_rate_cents INT CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents >= 0);

-- Extend the specialty allow-list with non-clinical roles (preserves all 9 clinical values).
ALTER TABLE public.specialists DROP CONSTRAINT IF EXISTS specialists_specialty_check;
ALTER TABLE public.specialists ADD CONSTRAINT specialists_specialty_check CHECK (specialty IN (
  'ob_gyn', 'midwife', 'doula', 'lactation_consultant', 'pediatrician',
  'sleep_coach', 'pelvic_floor_pt', 'perinatal_dietitian', 'ppd_therapist',
  'night_nurse', 'postpartum_doula', 'nanny', 'mothers_helper', 'babysitter'
));

-- Seed a small background-checked help cohort for the Miami launch market so the
-- "Extra hands" tier isn't empty in the pilot. admin_approved + accepting_patients
-- so they surface in specialists_near.
INSERT INTO public.specialists
  (npi_number, full_name, credentials, specialty, provider_kind, background_checked,
   background_checked_at, hourly_rate_cents, bio, city, state, lat, lng,
   accepting_patients, admin_approved, years_experience, rating_avg, review_count)
VALUES
  (NULL, 'Camila Vega', 'Newborn care · CPR certified', 'night_nurse', 'help', TRUE,
   now(), 2800, 'Overnight newborn care so you can sleep. Feeding, soothing, gentle routines.',
   'Miami', 'FL', 25.7617, -80.1918, TRUE, TRUE, 6, 5.0, 12),
  (NULL, 'Jess Thornton', 'Postpartum doula (DONA) · mother''s helper', 'postpartum_doula', 'help', TRUE,
   now(), 2500, 'Daytime hands — meals, tidying, holding the baby while you shower or nap.',
   'Miami', 'FL', 25.7907, -80.1300, TRUE, TRUE, 4, 4.8, 7),
  (NULL, 'Ana Morales', 'Experienced nanny · infant + toddler', 'nanny', 'help', TRUE,
   now(), 2200, 'Full- or part-time nanny care with references, background-checked and CPR-trained.',
   'Miami', 'FL', 25.7492, -80.2590, TRUE, TRUE, 8, 4.9, 15),
  (NULL, 'Sofia Nunez', 'Mother''s helper · after-school + evenings', 'mothers_helper', 'help', FALSE,
   NULL, 1800, 'A friendly extra pair of hands for busy afternoons and evenings.',
   'Miami', 'FL', 25.7700, -80.1300, TRUE, TRUE, 2, 4.7, 4);
