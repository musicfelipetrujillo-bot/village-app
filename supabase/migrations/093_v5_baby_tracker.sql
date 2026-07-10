-- 093_v5_baby_tracker.sql
-- V5 Playbook — real newborn tracker (replaces the ambiguous "log today" pills).
--
-- Four owner-scoped log tables behind the Playbook "Today" tracker:
--   baby_sleep_logs   — start/stop sleep sessions (ended_at NULL = in progress)
--   baby_feed_logs    — breast (L/R, timed) or bottle (timed + oz)
--   baby_diaper_logs  — one-tap wet / dirty / both
--   baby_log_notes    — free-form text/voice jots (AI parse lands in Phase 2)
--
-- baby_profiles is UNIQUE per user (008), so rows key on user_id directly and
-- carry baby_profile_id as the FK. RLS is strict owner-only — these are the
-- mom's private baby-care logs (health-adjacent data). The Playbook reads them
-- back to curate "today" and a weekly rhythm summary (Phase 3).

-- ── Sleep ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS baby_sleep_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_profile_id UUID NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,                       -- NULL = session in progress
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'note')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_baby_sleep_user_started ON baby_sleep_logs(user_id, started_at DESC);
-- At most one open (in-progress) sleep session per user.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_baby_sleep_active
  ON baby_sleep_logs(user_id) WHERE ended_at IS NULL;

-- ── Feeds ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS baby_feed_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_profile_id UUID NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  method          TEXT NOT NULL CHECK (method IN ('breast', 'bottle')),
  side            TEXT CHECK (side IN ('left', 'right')),   -- breast only; NULL for bottle
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,                       -- NULL = feed in progress (timer running)
  amount_oz       NUMERIC(4,1),                      -- bottle only
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'note')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_baby_feed_user_started ON baby_feed_logs(user_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_baby_feed_active
  ON baby_feed_logs(user_id) WHERE ended_at IS NULL;

-- ── Diapers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS baby_diaper_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_profile_id UUID NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('wet', 'dirty', 'both')),
  occurred_at     TIMESTAMPTZ NOT NULL,
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'note')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_baby_diaper_user_occurred ON baby_diaper_logs(user_id, occurred_at DESC);

-- ── Free-form notes (text / dictation; AI parse in Phase 2) ───────────────
CREATE TABLE IF NOT EXISTS baby_log_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_profile_id UUID NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  raw_text        TEXT NOT NULL,
  parsed          JSONB,                             -- Phase 2: AI-extracted entries
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_baby_notes_user_occurred ON baby_log_notes(user_id, occurred_at DESC);

-- ── RLS — strict owner-only on all four ───────────────────────────────────
ALTER TABLE baby_sleep_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE baby_feed_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE baby_diaper_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE baby_log_notes   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['baby_sleep_logs','baby_feed_logs','baby_diaper_logs','baby_log_notes']
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (auth.uid() = user_id);', tbl||'_sel', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (auth.uid() = user_id);', tbl||'_ins', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);', tbl||'_upd', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (auth.uid() = user_id);', tbl||'_del', tbl);
  END LOOP;
END $$;
