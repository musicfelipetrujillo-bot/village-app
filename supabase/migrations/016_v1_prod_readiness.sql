-- V1 Phase 10: Production readiness hardening
-- Run this against the production Supabase project before beta launch.

-- ── 1. Connection pooling comment ─────────────────────────
-- In Supabase Dashboard → Settings → Database → Connection Pooling:
-- Mode: Transaction (for serverless Edge Functions)
-- Pool size: 15 (default)

-- ── 2. Enable pg_stat_statements for query performance monitoring ──
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ── 3. Indexes for highest-traffic query paths ─────────────
-- Already in schema: idx_specialists_location (GIST), idx_specialists_specialty
-- Additional indexes identified from Phase 9 access patterns:

-- Appointments by user + status (My Appointments screen)
CREATE INDEX IF NOT EXISTS idx_appointments_user_status
  ON appointments (user_id, status, appointment_at DESC);

-- Appointments needing reminders (cron job query — runs every 15min)
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_window
  ON appointments (appointment_at, status, twilio_reminder_sent)
  WHERE status = 'confirmed' AND twilio_reminder_sent = FALSE;

-- Messages by specialist thread (MessagingScreen poll — every 30s)
CREATE INDEX IF NOT EXISTS idx_messages_thread
  ON messages (specialist_id, created_at ASC);

-- Reviews by specialist ordered by date (SpecialistProfileScreen)
CREATE INDEX IF NOT EXISTS idx_reviews_specialist_date
  ON reviews (specialist_id, created_at DESC);

-- Favorites by user (FavoritesScreen load)
CREATE INDEX IF NOT EXISTS idx_favorites_user
  ON favorites (user_id, created_at DESC);

-- NPI cache lookup
CREATE INDEX IF NOT EXISTS idx_npi_cache_fetched
  ON npi_cache (fetched_at DESC);

-- ── 4. Specialist search performance ──────────────────────
-- Ensure earthdistance/cube extensions are enabled
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- ── 5. Set statement_timeout for Edge Function queries ────
-- Prevents runaway queries from consuming connection pool
ALTER ROLE authenticated SET statement_timeout = '10s';
ALTER ROLE anon SET statement_timeout = '5s';

-- ── 6. Audit log table for admin actions ──────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,              -- 'approve_specialist', 'reject_specialist', 'delete_review'
  target_table TEXT NOT NULL,
  target_id UUID NOT NULL,
  performed_by TEXT NOT NULL DEFAULT 'system',  -- admin email or 'system'
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
-- Only service_role can read/write audit log
CREATE POLICY "audit_log_service_only" ON admin_audit_log
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── 7. Soft-delete support for users (GDPR / right to erasure) ──
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

-- RLS update: deleted users invisible to queries
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id AND deleted_at IS NULL);

-- ── 8. Beta flags ──────────────────────────────────────────
-- Feature flags table — used for gradual beta rollout
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percent SMALLINT NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
-- Public read (flags are not secret)
CREATE POLICY "feature_flags_public_read" ON feature_flags
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "feature_flags_service_write" ON feature_flags
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Seed initial flags
INSERT INTO feature_flags (key, enabled, rollout_percent, description) VALUES
  ('v1_specialists',      TRUE,  100, 'V1 Specialist Directory — full launch'),
  ('v1_ai_triage',        TRUE,  100, 'AI triage skill in Connect tab'),
  ('v1_stripe_payments',  FALSE,  20, 'In-app payment flow — rolling out to 20% of beta users'),
  ('v2_milk_connect',     FALSE,   0, 'V2 Milk Connect — not yet built'),
  ('v3_community',        FALSE,   0, 'V3 Community Rooms — not yet built')
ON CONFLICT (key) DO NOTHING;
