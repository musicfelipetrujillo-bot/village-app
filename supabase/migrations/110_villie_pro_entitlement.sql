-- 110_villie_pro_entitlement.sql
-- villie pro subscription entitlement + Manual video gating (Build 14).
--
-- Decisions (Felipe 2026-07-29, spec: docs/superpowers/specs/
-- 2026-07-29-villie-pro-video-paywall-design.md):
--   · $6.99/mo + $49.99/yr, 7-day trial, RevenueCat entitlement id 'pro'
--   · ALL Manual videos (week-intro + how-to) gate behind Pro
--   · 52-week written/text content stays free
--
-- SAFETY: gating is inert until the `pro_video_gate` feature flag flips ON.
-- This migration can (and should) apply to hosted before Build 14 ships —
-- the current OTA audience keeps playing videos until the flag flips, so we
-- never lock content for users who have no paywall to buy through.
--
-- Free users still receive full metadata (title, thumbnail, duration,
-- expert) with mux_playback_id/html_url nulled + is_locked=true, so the
-- client renders a teaser card — never a broken player.

-- ── 1. Entitlement flag on users ─────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. RevenueCat webhook event ledger ───────────────────────────────────────
-- Raw events for audit + idempotent replay. Written only by the
-- revenuecat-webhook edge function (service role); no client policies.
CREATE TABLE IF NOT EXISTS pro_subscription_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        TEXT NOT NULL UNIQUE,          -- RevenueCat event.id (anti-replay)
  user_id         UUID,                          -- app_user_id when it maps to us
  event_type      TEXT NOT NULL,                 -- INITIAL_PURCHASE / RENEWAL / ...
  product_id      TEXT,
  entitlement_ids TEXT[],
  environment     TEXT,                          -- SANDBOX / PRODUCTION
  event_timestamp TIMESTAMPTZ,
  raw             JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pro_sub_events_user ON pro_subscription_events(user_id);
ALTER TABLE pro_subscription_events ENABLE ROW LEVEL SECURITY;
-- intentionally no policies: service-role only (same posture as gear_boosts)

-- ── 3. Helpers ───────────────────────────────────────────────────────────────
-- current_user_is_pro — SECURITY DEFINER so SECURITY INVOKER RPCs can read the
-- caller's entitlement without depending on users-table RLS shape.
CREATE OR REPLACE FUNCTION current_user_is_pro()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE((SELECT u.is_pro FROM users u WHERE u.id = auth.uid()), FALSE);
$$;
REVOKE EXECUTE ON FUNCTION current_user_is_pro() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION current_user_is_pro() TO authenticated, service_role;

-- manual_videos_locked_for_caller — TRUE only when the kill-switch flag is on
-- AND the caller isn't Pro. service_role (ops/admin tooling) always sees
-- playback ids; anon locks with the flag like any non-Pro caller (nothing
-- anon-facing reads these surfaces — the share/OG pages use their own RPC).
CREATE OR REPLACE FUNCTION manual_videos_locked_for_caller()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE((SELECT ff.enabled FROM feature_flags ff WHERE ff.key = 'pro_video_gate'), FALSE)
         AND COALESCE(auth.role(), '') <> 'service_role'
         AND NOT current_user_is_pro();
$$;
-- anon keeps EXECUTE: the manual_week_intro SELECT policy (§7) references this
-- function, and 094 allowed anon reads of published rows — without EXECUTE an
-- anon SELECT would error instead of returning rows. For anon, auth.uid() IS
-- NULL → returns FALSE (unlocked), preserving 094 behavior exactly.
REVOKE EXECUTE ON FUNCTION manual_videos_locked_for_caller() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION manual_videos_locked_for_caller() TO anon, authenticated, service_role;

-- ── 4. Kill-switch flag (seeded OFF) ─────────────────────────────────────────
INSERT INTO feature_flags (key, enabled, rollout_percent, description) VALUES
  ('pro_video_gate', FALSE, 0,
   'Build 14: gate Manual videos behind villie pro. Flip ON only after the Build 14 paywall is live in the App Store.')
ON CONFLICT (key) DO NOTHING;

-- ── 5. list_manual_videos — add is_locked + null playback for free users ─────
-- (RETURNS TABLE shape changes → DROP first. Body mirrors 088 + gating.
-- is_locked is appended LAST so existing client decoders are unaffected.)
DROP FUNCTION IF EXISTS list_manual_videos(TEXT, TEXT, TEXT);
CREATE FUNCTION list_manual_videos(
  p_audience TEXT,
  p_category TEXT,
  p_locale   TEXT DEFAULT 'en'
) RETURNS TABLE (
  id                  UUID,
  title               TEXT,
  description         TEXT,
  duration_seconds    INT,
  mux_playback_id     TEXT,
  html_url            TEXT,
  thumbnail_url       TEXT,
  poster_url          TEXT,
  has_captions_en     BOOLEAN,
  has_captions_es     BOOLEAN,
  week_relevance      INT,
  age_min_weeks       INT,
  age_max_weeks       INT,
  sort_order          INT,
  is_watched          BOOLEAN,
  watched_seconds     INT,
  is_saved            BOOLEAN,
  is_locked           BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT
    mv.id,
    COALESCE(CASE WHEN p_locale = 'es' THEN i18n.title       END, mv.title)       AS title,
    COALESCE(CASE WHEN p_locale = 'es' THEN i18n.description END, mv.description) AS description,
    mv.duration_seconds,
    CASE WHEN manual_videos_locked_for_caller() THEN NULL ELSE mv.mux_playback_id END AS mux_playback_id,
    CASE WHEN manual_videos_locked_for_caller() THEN NULL ELSE mv.html_url        END AS html_url,
    mv.thumbnail_url,
    mv.poster_url,
    mv.has_captions_en,
    mv.has_captions_es,
    mv.week_relevance,
    mv.age_min_weeks,
    mv.age_max_weeks,
    mv.sort_order,
    (vp.completed_at IS NOT NULL) AS is_watched,
    COALESCE(vp.watched_seconds, 0) AS watched_seconds,
    (sv.user_id IS NOT NULL)        AS is_saved,
    manual_videos_locked_for_caller() AS is_locked
  FROM manual_videos mv
  LEFT JOIN manual_videos_i18n i18n
         ON i18n.video_id = mv.id AND i18n.locale = p_locale
  LEFT JOIN manual_video_progress vp
         ON vp.video_id = mv.id AND vp.user_id = auth.uid()
  LEFT JOIN manual_video_saves sv
         ON sv.video_id = mv.id AND sv.user_id = auth.uid()
  WHERE mv.audience = p_audience
    AND mv.category = p_category
    AND mv.review_status = 'approved'
  ORDER BY mv.sort_order ASC, mv.created_at ASC;
$$;
REVOKE EXECUTE ON FUNCTION list_manual_videos(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION list_manual_videos(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ── 6. get_manual_week_intro RPC + gate the direct-read path ─────────────────
-- The client previously SELECTed manual_week_intro directly (public-read
-- policy from 094) — and the OTA bundles in the field still do. That path
-- can't gate columns, so the new client moves to this RPC; the direct path's
-- policy (rewritten in §7) returns zero rows to locked callers instead of
-- leaking playback ids. With the flag OFF nothing changes for old bundles.
CREATE OR REPLACE FUNCTION get_manual_week_intro(
  p_audience TEXT,
  p_week     INT,
  p_locale   TEXT DEFAULT 'en'
) RETURNS TABLE (
  id               UUID,
  week_number      INT,
  title            TEXT,
  expert_name      TEXT,
  expert_role      TEXT,
  mux_playback_id  TEXT,
  poster_url       TEXT,
  duration_seconds INT,
  is_locked        BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    wi.id,
    wi.week_number,
    wi.title,
    wi.expert_name,
    wi.expert_role,
    CASE WHEN manual_videos_locked_for_caller() THEN NULL ELSE wi.mux_playback_id END AS mux_playback_id,
    wi.poster_url,
    wi.duration_seconds,
    manual_videos_locked_for_caller() AS is_locked
  FROM manual_week_intro wi
  WHERE wi.audience     = p_audience
    AND wi.week_number  = p_week
    AND wi.locale       = p_locale
    AND wi.is_published = TRUE
    AND wi.mux_playback_id IS NOT NULL
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION get_manual_week_intro(TEXT, INT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_manual_week_intro(TEXT, INT, TEXT) TO authenticated, service_role;

-- ── 7. Rewrite the direct-read policy ────────────────────────────────────────
-- Old OTA bundles keep working while the flag is OFF (policy is equivalent to
-- 094's is_published check). Once the flag flips, locked callers get zero rows
-- through PostgREST — their week-intro slot hides via the existing fail-soft
-- path in api/manual.ts — while Pro users' old bundles keep playing.
DROP POLICY IF EXISTS manual_week_intro_public_read ON manual_week_intro;
CREATE POLICY manual_week_intro_public_read ON manual_week_intro
  FOR SELECT USING (is_published = TRUE AND NOT manual_videos_locked_for_caller());
