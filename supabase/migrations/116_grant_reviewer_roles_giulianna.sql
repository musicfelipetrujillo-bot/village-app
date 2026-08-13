-- 116_grant_reviewer_roles_giulianna.sql
-- Bootstrap DATA grant (not schema). Adds a SECOND reviewer alongside the
-- founder's primary login: giulipino97@gmail.com (id 9b785cab, signed up
-- 2026-05-29) gets both review privileges —
--
--   is_clinical_reviewer  → The Buzz medical-claim sign-off + weekly-journey
--                           clinical review queue (helper: migration 043,
--                           consumers: migrations 042 + 105)
--   is_event_reviewer     → partner-feed event ingest review queue
--                           (helper + consumers: migration 046)
--
-- This intentionally REVERSES the single-reviewer consolidation done in
-- migrations 106/107/108 — those moved every flag onto one founder account;
-- this migration widens the clinical + event queues to two people so review
-- is not blocked on a single person. The founder's grants are left untouched.
--
-- ⚠️ Compliance note (not a code concern): is_clinical_reviewer gates who may
-- approve MEDICAL-CLAIM content for publication (see migration 105 header).
-- The Risk & Compliance posture assumes a clinically-qualified human on that
-- queue. Granting it here is a deliberate operator decision; the pending
-- clinical-advisor sign-off gate for The Buzz is unchanged by this migration.
--
-- Idempotent + email-scoped: a harmless no-op in any environment where that
-- row does not exist (fresh/local resets).
UPDATE public.users
   SET is_clinical_reviewer = TRUE,
       is_event_reviewer    = TRUE
 WHERE lower(email) = 'giulipino97@gmail.com';
