-- 061_v1_specialist_npi_optional.sql
--
-- Relaxes `specialists.npi_number` from NOT NULL to NULLable.
--
-- Why: V1 invite onboarding (migration 060 + specialist-invite-accept edge
-- function) extends the platform beyond insurance-billing providers. NPIs
-- are issued by CMS to billable healthcare providers (OB/GYNs, midwives,
-- pediatricians, PT, RDs that bill, MD therapists). They are NOT issued to:
--   - doulas (non-clinical labor support)
--   - lactation_consultant IBCLCs (not all are NPs/RNs/MDs)
--   - sleep_coach (non-clinical)
--   - certain perinatal_dietitian roles (private-pay only)
--   - ppd_therapist LCSWs (have NPIs but invite-only workflow allows TBD)
--
-- Postgres UNIQUE constraint allows multiple NULLs, so this is safe — the
-- column stays UNIQUE for the specialists who do have an NPI, while
-- non-billing roles can sit with NULL. The npi_verified column (already
-- DEFAULT FALSE) continues to gate any "verified billing provider" UI.
--
-- No data migration needed — existing rows all have non-null NPIs.

ALTER TABLE specialists
  ALTER COLUMN npi_number DROP NOT NULL;

COMMENT ON COLUMN specialists.npi_number IS
  'CMS National Provider Identifier. Optional — non-billing roles (doula, IBCLC, sleep coach) often have no NPI. UNIQUE constraint still applies when set. npi_verified gates "verified billing provider" UI.';
