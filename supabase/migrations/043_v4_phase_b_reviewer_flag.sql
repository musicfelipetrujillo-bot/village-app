-- V4 Phase B — Replace hardcoded reviewer UUID with a flag on `users`
--
-- Migration 042 hardcoded `is_clinical_reviewer()` to a single seeded test
-- UUID (`c16f69ae-445d-4348-83f0-592605f6ec37` = `rey@village.test`). That
-- worked for local dev but is unusable on hosted Supabase, where the seeded
-- UUID does not exist. Onboarding a real reviewer would require a code
-- change + redeploy.
--
-- This migration moves authorization to a `users.is_clinical_reviewer`
-- boolean. Adding a reviewer becomes:
--   UPDATE users SET is_clinical_reviewer = TRUE WHERE email = '...';
-- No code change. The `list_pending_review` / `approve_content_row` /
-- `reject_content_row` RPCs from migration 042 already gate on the helper —
-- they pick up the new logic automatically.

-- ---------------------------------------------------------------------------
-- 1. Column — defaults FALSE so existing rows are unprivileged.
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_clinical_reviewer BOOLEAN NOT NULL DEFAULT FALSE;

-- A partial index keeps the helper fast even as the user table grows; the
-- helper does an `auth.uid()` equality lookup so the PK index already covers
-- it, but the partial index is cheap insurance for any future "list all
-- reviewers" admin view.
CREATE INDEX IF NOT EXISTS idx_users_is_clinical_reviewer
  ON users(id)
  WHERE is_clinical_reviewer = TRUE;

-- ---------------------------------------------------------------------------
-- 2. Helper rewrite — read from the column instead of hardcoded UUID.
-- ---------------------------------------------------------------------------
-- COALESCE handles two edge cases:
--   - auth.uid() is NULL (anonymous / service role with no JWT) → FALSE
--   - users row missing for the auth.uid() → FALSE
-- Either way: an unauthenticated or unknown caller is never a reviewer.
CREATE OR REPLACE FUNCTION is_clinical_reviewer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_clinical_reviewer FROM users WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Backfill — preserve local-dev behavior for the seeded test reviewer.
-- ---------------------------------------------------------------------------
-- Idempotent: only flips the flag if the seeded user actually exists in this
-- DB. On hosted (where it does not), this is a no-op.
UPDATE users
   SET is_clinical_reviewer = TRUE
 WHERE id = 'c16f69ae-445d-4348-83f0-592605f6ec37'::uuid
   AND is_clinical_reviewer = FALSE;
