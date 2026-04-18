-- V1 — Specialist Directory: Initial Schema
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;
CREATE EXTENSION IF NOT EXISTS cube;

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  pregnancy_stage TEXT CHECK (pregnancy_stage IN (
    'trying','first_trimester','second_trimester','third_trimester',
    'postpartum_0_6mo','postpartum_6_12mo','postpartum_1yr_plus')),
  due_date DATE,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en','es')),
  insurance_provider TEXT,
  zip_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Specialists
CREATE TABLE specialists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  npi_number TEXT UNIQUE NOT NULL,
  npi_verified BOOLEAN DEFAULT FALSE,
  npi_verified_at TIMESTAMPTZ,
  full_name TEXT NOT NULL,
  credentials TEXT NOT NULL,
  specialty TEXT NOT NULL CHECK (specialty IN (
    'ob_gyn','midwife','doula','lactation_consultant','pediatrician',
    'sleep_coach','pelvic_floor_pt','perinatal_dietitian','ppd_therapist')),
  bio TEXT,
  photo_url TEXT,
  practice_name TEXT,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  phone TEXT,
  website_url TEXT,
  telehealth_available BOOLEAN DEFAULT FALSE,
  telehealth_link TEXT,
  accepting_patients BOOLEAN DEFAULT TRUE,
  years_experience INT,
  rating_avg DECIMAL(3,2) DEFAULT 0.00,
  review_count INT DEFAULT 0,
  review_summary_cache TEXT,
  review_summary_cached_at TIMESTAMPTZ,
  zocdoc_provider_id TEXT,
  calendly_username TEXT,
  stripe_account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_specialists_specialty ON specialists(specialty);
CREATE INDEX idx_specialists_location ON specialists USING GIST(ll_to_earth(lat, lng));

-- Specialist sub-tables
CREATE TABLE specialist_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  UNIQUE (specialist_id, language_code)
);

CREATE TABLE specialist_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  insurance_name TEXT NOT NULL,
  plan_type TEXT,
  UNIQUE (specialist_id, insurance_name, plan_type)
);

CREATE TABLE specialist_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  description TEXT,
  price_cents INT,
  duration_min INT,
  UNIQUE (specialist_id, service_name)
);

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  ai_summary TEXT,
  verified_patient BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (specialist_id, user_id)
);

-- Favorites
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, specialist_id)
);

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('zocdoc','calendly','in_app')),
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','confirmed','cancelled','completed','no_show')),
  appointment_at TIMESTAMPTZ NOT NULL,
  duration_min INT DEFAULT 60,
  service_type TEXT,
  is_telehealth BOOLEAN DEFAULT FALSE,
  telehealth_link TEXT,
  notes TEXT,
  stripe_payment_intent_id TEXT,
  amount_cents INT,
  twilio_reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages (specialist DMs)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI conversations
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialist_id UUID REFERENCES specialists(id) ON DELETE SET NULL,
  skill_type TEXT NOT NULL CHECK (skill_type IN (
    'match','profile_qa','translate','review_summary',
    'appointment_reminder','followup_questions','triage')),
  messages JSONB NOT NULL DEFAULT '[]',
  context_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Specialist translations (cached by content_hash)
CREATE TABLE specialist_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  field_name TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (specialist_id, language_code, field_name, content_hash)
);

-- NPI cache (30 day TTL enforced by app layer)
CREATE TABLE npi_cache (
  npi_number TEXT PRIMARY KEY,
  raw_response JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_specialists_updated_at BEFORE UPDATE ON specialists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
