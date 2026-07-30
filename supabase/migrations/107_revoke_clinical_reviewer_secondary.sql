-- 107_revoke_clinical_reviewer_secondary.sql
-- Revoke the clinical-reviewer role from the secondary email/password account
-- (felitrujillo95@hotmail.com). The role now lives solely on the founder's
-- primary Apple login (fele_trujillo@hotmail.com — see migration 106), leaving
-- a single reviewer account.
--
-- Idempotent + email-scoped: harmless no-op where that row doesn't exist.
-- NOTE: this does NOT touch the gear-moderator role, which is configured
-- separately via the GEAR_MODERATOR_EXTERNAL_IDS env, not this column.
UPDATE public.users
   SET is_clinical_reviewer = FALSE
 WHERE lower(email) = 'felitrujillo95@hotmail.com';
