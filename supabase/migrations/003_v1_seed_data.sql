-- V1 — Seed data (local dev only)
-- Run via: supabase db reset

-- Sample specialists for Miami
INSERT INTO specialists (npi_number, full_name, credentials, specialty, bio, city, state, zip_code, lat, lng, telehealth_available, accepting_patients, rating_avg, review_count, years_experience)
VALUES
  ('1234567890', 'Dr. Ana Rodriguez', 'MD, IBCLC', 'lactation_consultant',
   'Board-certified lactation consultant with 12 years helping Miami moms breastfeed successfully.',
   'Miami', 'FL', '33131', 25.7617, -80.1918, true, true, 4.90, 47, 12),

  ('2345678901', 'Maria Santos', 'CD(DONA), CPD', 'doula',
   'Certified postpartum doula serving Miami-Dade for 8 years. Bilingual EN/ES/PT.',
   'Coral Gables', 'FL', '33146', 25.7210, -80.2684, false, true, 4.80, 31, 8),

  ('3456789012', 'Dr. Jennifer Lee', 'DPT, PRPC', 'pelvic_floor_pt',
   'Pelvic floor physical therapist specializing in postpartum recovery.',
   'Coral Gables', 'FL', '33146', 25.7310, -80.2584, false, true, 4.95, 22, 7),

  ('4567890123', 'Coach Sarah Mills', 'CBS', 'sleep_coach',
   'Certified baby sleep specialist. Gentle methods that actually work.',
   'Miami', 'FL', '33101', 25.7750, -80.1960, true, true, 4.85, 63, 5),

  ('5678901234', 'Dr. Carmen Vega', 'RDN, IBCLC', 'perinatal_dietitian',
   'Registered dietitian specializing in lactation nutrition and postpartum recovery.',
   'Brickell', 'FL', '33129', 25.7500, -80.1900, true, true, 4.70, 18, 9),

  ('6789012345', 'Dr. Lisa Chen', 'LCSW, PMH-C', 'ppd_therapist',
   'Licensed therapist specializing in perinatal mood disorders. Confidential telehealth.',
   'Miami Beach', 'FL', '33139', 25.7907, -80.1300, true, true, 4.92, 38, 11);

-- Sample languages
INSERT INTO specialist_languages (specialist_id, language_code)
SELECT id, 'en' FROM specialists;

INSERT INTO specialist_languages (specialist_id, language_code)
SELECT id, 'es' FROM specialists WHERE full_name IN ('Dr. Ana Rodriguez', 'Maria Santos', 'Dr. Jennifer Lee', 'Dr. Carmen Vega');

INSERT INTO specialist_languages (specialist_id, language_code)
SELECT id, 'pt' FROM specialists WHERE full_name = 'Maria Santos';
