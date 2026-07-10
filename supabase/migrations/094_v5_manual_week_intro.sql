-- 094_v5_manual_week_intro.sql
-- Week-level "this week" specialist video for the Manual.
--
-- This is the STANDARDIZED specialist-video surface (replaces scattered
-- per-chapter videos): exactly one overview video per week, shown at the top of
-- the Manual week (above the chapter chips), independent of Sleep/Feed/Grow/Care.
-- Keyed by (audience, week_number, locale) — NOT by category. Felipe uploads one
-- Mux video per week; the UI hides the slot for any week without a published row.
--
-- Lives in its own table (not manual_videos, which is category-keyed); the player
-- plays it via a direct mux_playback_id path (see ClipPlayer ClipRef.playbackId).

CREATE TABLE IF NOT EXISTS manual_week_intro (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience        TEXT NOT NULL DEFAULT 'baby' CHECK (audience IN ('baby', 'mom')),
  week_number     INT  NOT NULL CHECK (week_number BETWEEN 0 AND 104),
  locale          TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'es')),
  title           TEXT NOT NULL DEFAULT 'What to expect this week',
  expert_name     TEXT,
  expert_role     TEXT,
  mux_playback_id TEXT,
  poster_url      TEXT,
  duration_seconds INT,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audience, week_number, locale)
);
CREATE INDEX IF NOT EXISTS idx_manual_week_intro_lookup
  ON manual_week_intro(audience, week_number, locale) WHERE is_published = true;

-- Public read of PUBLISHED rows only; writes are service-role only (no
-- INSERT/UPDATE/DELETE policy → blocked for anon + authenticated; service_role
-- bypasses RLS for uploads via the dashboard / an admin tool).
ALTER TABLE manual_week_intro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS manual_week_intro_public_read ON manual_week_intro;
CREATE POLICY manual_week_intro_public_read ON manual_week_intro
  FOR SELECT USING (is_published = true);
