-- V1 Phase 7: Admin approval queue for specialists
-- Adds admin_approved flag + admin_queue view + RLS update
-- Run after 001_v1_initial_schema.sql

-- Add admin approval columns to specialists
ALTER TABLE specialists
  ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_rejection_reason TEXT;

-- Index for admin queue (unapproved + NPI verified = pending review)
CREATE INDEX IF NOT EXISTS idx_specialists_admin_queue
  ON specialists (npi_verified, admin_approved, created_at DESC)
  WHERE npi_verified = TRUE AND admin_approved = FALSE;

-- Admin queue view — used by admin dashboard / Edge Function
-- Only service_role can SELECT from this view via RLS
CREATE OR REPLACE VIEW specialist_admin_queue AS
  SELECT
    s.id,
    s.full_name,
    s.credentials,
    s.specialty,
    s.npi_number,
    s.npi_verified,
    s.npi_verified_at,
    s.admin_approved,
    s.admin_approved_at,
    s.admin_rejection_reason,
    s.practice_name,
    s.city,
    s.state,
    s.phone,
    s.created_at,
    u.email AS user_email,
    u.phone AS user_phone
  FROM specialists s
  LEFT JOIN users u ON u.id = s.user_id
  WHERE s.npi_verified = TRUE
    AND s.admin_approved = FALSE
  ORDER BY s.npi_verified_at DESC;

-- Deny all direct access to the view from client; accessed only via Edge Functions
REVOKE ALL ON specialist_admin_queue FROM anon, authenticated;
GRANT SELECT ON specialist_admin_queue TO service_role;

-- Update RLS on specialists: moms can only see admin_approved specialists
-- (replaces the broad public read policy from 002_v1_rls_policies.sql)
DROP POLICY IF EXISTS "Specialists are publicly readable" ON specialists;

CREATE POLICY "Approved specialists are publicly readable"
  ON specialists FOR SELECT
  TO authenticated
  USING (admin_approved = TRUE);

-- Service role can do anything (needed for admin approval flow)
CREATE POLICY "Service role has full access to specialists"
  ON specialists FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Seed data: mark existing seed specialists as admin_approved so they stay visible
UPDATE specialists SET admin_approved = TRUE, admin_approved_at = NOW()
WHERE npi_number IS NOT NULL;
