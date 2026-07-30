-- 108_consolidate_reviewer_flags_to_founder.sql
-- Consolidate reviewer flags onto the founder's PRIMARY login
-- (fele_trujillo@hotmail.com, id e1d6d00f) and off the secondary seed/admin
-- account (felitrujillo95@hotmail.com, id eb2c4fc7). Clinical-reviewer was
-- already moved in migrations 106/107; this handles the event-reviewer flag
-- so every review privilege lives on a single primary account.
-- Idempotent + email-scoped: harmless no-op where the row doesn't exist.
UPDATE public.users SET is_event_reviewer = TRUE  WHERE lower(email) = 'fele_trujillo@hotmail.com';
UPDATE public.users SET is_event_reviewer = FALSE WHERE lower(email) = 'felitrujillo95@hotmail.com';
