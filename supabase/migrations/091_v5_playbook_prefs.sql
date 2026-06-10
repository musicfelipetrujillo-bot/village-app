-- 091_v5_playbook_prefs.sql
-- V5 Phase 5.2 (foundation): persist the Playbook personalization preferences.
-- Until now the Manual "Playbook" tune controls (sleep approach / feeding /
-- solids stage) were LOCAL-ONLY React state that reset on every app restart.
-- These three columns make them durable + editable, and become the spine input
-- the real personalized Playbook + "Today's plan" build on in 5.2/5.3.
--
-- Values mirror the mobile PbSleep / PbFeed / PbSolids unions exactly.
-- Nullable (no default): NULL = "not set yet" → the UI falls back to its
-- existing defaults (mixed / breast / notyet).
--
-- Read path note: getMyBabyProfile reads the `baby_profiles_with_week` VIEW;
-- rather than DROP/recreate that view (its Data-API grants aren't explicit and
-- a recreate risks breaking exposure), the API merges these columns via a small
-- direct select on the base table. RLS owner-only (008) already protects them.

ALTER TABLE baby_profiles
  ADD COLUMN IF NOT EXISTS pb_sleep_pref  TEXT CHECK (pb_sleep_pref  IN ('cosleep', 'training', 'mixed')),
  ADD COLUMN IF NOT EXISTS pb_feed_pref   TEXT CHECK (pb_feed_pref   IN ('breast', 'formula', 'mixed')),
  ADD COLUMN IF NOT EXISTS pb_solids_pref TEXT CHECK (pb_solids_pref IN ('notyet', 'starting', 'going'));
