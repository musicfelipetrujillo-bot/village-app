-- 106_grant_clinical_reviewer_founder.sql
-- Bootstrap DATA grant (not schema). Gives the founder's PRIMARY login
-- (fele_trujillo@hotmail.com, Apple Sign-In) the clinical-reviewer role so
-- The Buzz + weekly-journey review queue is reachable from the account the
-- founder actually uses day-to-day. The role was previously only on the
-- secondary email/password account (felitrujillo95@hotmail.com), which the
-- founder does not normally sign into.
--
-- Idempotent + email-scoped: a harmless no-op in any environment where that
-- row does not exist (fresh/local resets). The clinical-reviewer role gates
-- who can approve medical content for publication — see migration 105 and
-- is_clinical_reviewer() (migration 043).
UPDATE public.users
   SET is_clinical_reviewer = TRUE
 WHERE lower(email) = 'fele_trujillo@hotmail.com';
