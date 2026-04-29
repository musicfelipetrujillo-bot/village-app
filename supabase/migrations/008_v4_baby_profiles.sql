-- V4 Phase G1 — Baby profiles + notifications feed
-- Paired with 009_v4_milestone_library.sql (milestones + seed + RLS + RPCs).
-- See docs/MASTER_PLAN.md § V4 — Database Schema.

CREATE TABLE baby_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  baby_name TEXT,
  date_of_birth DATE NOT NULL,
  due_date DATE,
  gender TEXT CHECK (gender IN ('female', 'male', 'nonbinary', 'unknown')),
  birth_weight_grams INTEGER,
  is_premature BOOLEAN NOT NULL DEFAULT FALSE,
  corrected_age_offset_days INTEGER DEFAULT 0,
  feeding_method TEXT CHECK (feeding_method IN ('breastfed', 'formula', 'combo', 'pumped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_baby_profiles_user ON baby_profiles(user_id);

-- current_week_number is computed at read time via a view.
-- Postgres generated columns must be IMMUTABLE; CURRENT_DATE is STABLE, so the
-- cleaner path is a view. RLS on the view is inherited from baby_profiles
-- (enforce_security_invoker default in PG15+ / security_invoker option below).
CREATE OR REPLACE VIEW baby_profiles_with_week
WITH (security_invoker = true) AS
SELECT
  bp.*,
  GREATEST(1, LEAST(104,
    (
      (CURRENT_DATE - (bp.date_of_birth + make_interval(days => COALESCE(bp.corrected_age_offset_days, 0)))::date) / 7
      + 1
    )::SMALLINT
  )) AS current_week_number
FROM baby_profiles bp;

-- Touch updated_at on any change
CREATE OR REPLACE FUNCTION touch_baby_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_baby_profiles_touch
  BEFORE UPDATE ON baby_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_baby_profile_updated_at();

-- User notifications feed (scheduled + sent notifications — also backs in-app feed UI later)
CREATE TABLE user_notifications_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'milestone_alert', 'event_reminder', 'deal_expiry', 'gear_message', 'daily_checkin', 'new_match'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  deeplink TEXT,
  reference_id UUID,
  reference_table TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_sent BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_feed_user_created ON user_notifications_feed(user_id, created_at DESC);
CREATE INDEX idx_notif_feed_scheduled ON user_notifications_feed(scheduled_for) WHERE is_sent = FALSE;

-- RLS
ALTER TABLE baby_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications_feed ENABLE ROW LEVEL SECURITY;

-- baby_profiles: own row only
CREATE POLICY "baby_profiles_select_own" ON baby_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "baby_profiles_insert_own" ON baby_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "baby_profiles_update_own" ON baby_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "baby_profiles_delete_own" ON baby_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- user_notifications_feed: own rows read/update (mark read); inserts via service role only (cron/edge functions)
CREATE POLICY "notif_feed_select_own" ON user_notifications_feed
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_feed_update_own" ON user_notifications_feed
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_feed_insert_service" ON user_notifications_feed
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
