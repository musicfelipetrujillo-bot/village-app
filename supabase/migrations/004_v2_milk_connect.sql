-- V2 Milk Connect — core tables
-- Run after 003_v1_seed_data.sql

-- ── 1. Donor profiles ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS milk_donor_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name                VARCHAR(100) NOT NULL,
  avatar_url                  TEXT,
  neighborhood                VARCHAR(150),
  city                        VARCHAR(100),
  state                       VARCHAR(50),
  zip_code                    VARCHAR(10),
  lat                         DECIMAL(10,7),
  lng                         DECIMAL(10,7),
  bio                         TEXT,
  price_per_oz                DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  supply_oz_available         INTEGER NOT NULL DEFAULT 0,
  is_active                   BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified                 BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_account_id           TEXT,
  stripe_onboarding_complete  BOOLEAN DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_donor_profiles_location
  ON milk_donor_profiles USING GIST(ll_to_earth(lat, lng));
CREATE INDEX IF NOT EXISTS idx_donor_profiles_active
  ON milk_donor_profiles (is_active, is_verified);

ALTER TABLE milk_donor_profiles ENABLE ROW LEVEL SECURITY;

-- ── 2. Trust badges ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milk_trust_badges (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id            UUID NOT NULL REFERENCES milk_donor_profiles(id) ON DELETE CASCADE UNIQUE,
  questionnaire_complete      BOOLEAN NOT NULL DEFAULT FALSE,
  questionnaire_completed_at  TIMESTAMPTZ,
  bloodwork_linked            BOOLEAN NOT NULL DEFAULT FALSE,
  bloodwork_verified_at       TIMESTAMPTZ,
  bloodwork_report_url        TEXT,
  diet_disclosed              BOOLEAN NOT NULL DEFAULT FALSE,
  medications_disclosed       BOOLEAN NOT NULL DEFAULT FALSE,
  badge_level                 VARCHAR(30) NOT NULL DEFAULT 'none'
    CHECK (badge_level IN ('none','basic','verified','verified_bloodwork')),
  ai_safety_score             DECIMAL(4,2),
  ai_safety_flags             JSONB,
  ai_last_evaluated_at        TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE milk_trust_badges ENABLE ROW LEVEL SECURITY;

-- ── 3. Questionnaire responses ────────────────────────────
CREATE TABLE IF NOT EXISTS milk_questionnaire_responses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id  UUID NOT NULL REFERENCES milk_donor_profiles(id) ON DELETE CASCADE,
  question_key      VARCHAR(100) NOT NULL,
  question_text     TEXT NOT NULL,
  answer_value      TEXT NOT NULL,
  answered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (donor_profile_id, question_key)
);
ALTER TABLE milk_questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- ── 4. Diet flags ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milk_donor_diet_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id  UUID NOT NULL REFERENCES milk_donor_profiles(id) ON DELETE CASCADE,
  flag_key          VARCHAR(60) NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (donor_profile_id, flag_key)
  -- flag_key values: 'dairy_free','organic','gluten_free','vegan','nut_free'
);
ALTER TABLE milk_donor_diet_flags ENABLE ROW LEVEL SECURITY;

-- ── 5. Medications ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milk_donor_medications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id  UUID NOT NULL REFERENCES milk_donor_profiles(id) ON DELETE CASCADE,
  medication_name   VARCHAR(200) NOT NULL,
  dosage            VARCHAR(100),
  frequency         VARCHAR(100),
  notes             TEXT,
  is_current        BOOLEAN NOT NULL DEFAULT TRUE
);
ALTER TABLE milk_donor_medications ENABLE ROW LEVEL SECURITY;

-- ── 6. Listings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milk_listings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id  UUID NOT NULL REFERENCES milk_donor_profiles(id) ON DELETE CASCADE,
  oz_available      INTEGER NOT NULL CHECK (oz_available > 0),
  price_per_oz      DECIMAL(5,2) NOT NULL,
  min_order_oz      INTEGER NOT NULL DEFAULT 4,
  pickup_available  BOOLEAN NOT NULL DEFAULT TRUE,
  shipping_available BOOLEAN NOT NULL DEFAULT FALSE,
  shipping_price    DECIMAL(6,2),
  notes             TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','sold_out','deleted')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE milk_listings ENABLE ROW LEVEL SECURITY;

-- ── 7. Transactions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milk_transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id              UUID NOT NULL REFERENCES milk_listings(id),
  donor_profile_id        UUID NOT NULL REFERENCES milk_donor_profiles(id),
  recipient_user_id       UUID NOT NULL REFERENCES auth.users(id),
  oz_purchased            INTEGER NOT NULL,
  price_per_oz            DECIMAL(5,2) NOT NULL,
  subtotal_cents          INTEGER NOT NULL,
  platform_fee_cents      INTEGER NOT NULL,   -- 15%
  total_charged_cents     INTEGER NOT NULL,
  donor_payout_cents      INTEGER NOT NULL,
  stripe_payment_intent   TEXT NOT NULL,
  stripe_transfer_id      TEXT,
  fulfillment_method      VARCHAR(20) NOT NULL CHECK (fulfillment_method IN ('pickup','shipping')),
  status                  VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','fulfilled','disputed','refunded','cancelled')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE milk_transactions ENABLE ROW LEVEL SECURITY;

-- ── 8. Message threads ────────────────────────────────────
CREATE TABLE IF NOT EXISTS milk_message_threads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id  UUID NOT NULL REFERENCES milk_donor_profiles(id),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id),
  listing_id        UUID REFERENCES milk_listings(id),
  last_message_at   TIMESTAMPTZ,
  UNIQUE (donor_profile_id, recipient_user_id)
);
ALTER TABLE milk_message_threads ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS milk_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES milk_message_threads(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id),
  body        TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE milk_messages ENABLE ROW LEVEL SECURITY;

-- ── 9. Reviews ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS milk_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    UUID NOT NULL REFERENCES milk_transactions(id) UNIQUE,
  donor_profile_id  UUID NOT NULL REFERENCES milk_donor_profiles(id),
  reviewer_user_id  UUID NOT NULL REFERENCES auth.users(id),
  rating            SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body              TEXT,
  response_body     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE milk_reviews ENABLE ROW LEVEL SECURITY;

-- ── 10. Saved donors ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS milk_saved_donors (
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  donor_profile_id  UUID NOT NULL REFERENCES milk_donor_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, donor_profile_id)
);
ALTER TABLE milk_saved_donors ENABLE ROW LEVEL SECURITY;

-- ── 11. Updated_at trigger (shared function reuse) ────────
CREATE OR REPLACE FUNCTION update_milk_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_donor_profiles_updated_at
  BEFORE UPDATE ON milk_donor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_milk_updated_at();

CREATE TRIGGER trg_milk_listings_updated_at
  BEFORE UPDATE ON milk_listings
  FOR EACH ROW EXECUTE FUNCTION update_milk_updated_at();

CREATE TRIGGER trg_milk_transactions_updated_at
  BEFORE UPDATE ON milk_transactions
  FOR EACH ROW EXECUTE FUNCTION update_milk_updated_at();

CREATE TRIGGER trg_milk_trust_badges_updated_at
  BEFORE UPDATE ON milk_trust_badges
  FOR EACH ROW EXECUTE FUNCTION update_milk_updated_at();

-- ── 12. Badge level recalculation function ────────────────
CREATE OR REPLACE FUNCTION recalculate_milk_badge_level(p_donor_profile_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_badge milk_trust_badges%ROWTYPE;
  v_level VARCHAR(30);
BEGIN
  SELECT * INTO v_badge FROM milk_trust_badges WHERE donor_profile_id = p_donor_profile_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_badge.bloodwork_linked AND v_badge.questionnaire_complete AND v_badge.diet_disclosed THEN
    v_level := 'verified_bloodwork';
  ELSIF v_badge.questionnaire_complete AND v_badge.diet_disclosed AND v_badge.medications_disclosed THEN
    v_level := 'verified';
  ELSIF v_badge.questionnaire_complete THEN
    v_level := 'basic';
  ELSE
    v_level := 'none';
  END IF;

  UPDATE milk_trust_badges SET badge_level = v_level WHERE donor_profile_id = p_donor_profile_id;
END;
$$;
