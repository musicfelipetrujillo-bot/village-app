-- 068_v4_saved_dashboard.sql
--
-- Unified Saved hub aggregate RPC (2026-05-21).
--
-- Powers a single screen at Me → Saved that shows the user's bookmarks
-- across all four content types in one place:
--   * Manual videos   (manual_video_saves)
--   * Specialists     (favorites)
--   * Milk donors     (milk_saved_donors)
--   * Gear listings   (gear_saved_listings)
--
-- Each section returns latest 3 rows + a count of total saves. The mobile
-- SavedDashboardScreen reuses the existing per-type detail screens behind
-- a "See all →" link, so we don't need polymorphic cards — just thin
-- preview cards per section.
--
-- Schema reconciliation:
--   * favorites uses created_at (not saved_at) — predates the modern
--     saved-X tables. Migration leaves it alone; the RPC aliases to a
--     common shape.
--   * milk_saved_donors had NO timestamp column. This migration adds
--     `saved_at TIMESTAMPTZ DEFAULT NOW()`, backfills NOW() for existing
--     rows (harmless — only one user has used the feature in prod so
--     ordering changes from "table-physical" to "NOW()" which is fine).

-- ── (1) Backfill saved_at on milk_saved_donors ───────────────────
ALTER TABLE milk_saved_donors
  ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_milk_saved_donors_user_recent
  ON milk_saved_donors(user_id, saved_at DESC);


-- ── (2) get_saved_dashboard — one round-trip for the whole screen ─
-- Returns a single JSONB blob with four sections + counts. SECURITY
-- INVOKER so all four sub-queries flow through the existing RLS
-- (favorites_select_own / manual_saves_select_own / etc.).
CREATE OR REPLACE FUNCTION get_saved_dashboard(p_locale TEXT DEFAULT 'en')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_videos        JSONB;
  v_video_count   INT;
  v_specialists   JSONB;
  v_spec_count    INT;
  v_donors        JSONB;
  v_donor_count   INT;
  v_gear          JSONB;
  v_gear_count    INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- ── Manual videos ──
  SELECT COUNT(*) INTO v_video_count
  FROM manual_video_saves WHERE user_id = v_uid;

  SELECT jsonb_agg(t.*) INTO v_videos FROM (
    SELECT mv.id, mv.audience, mv.category,
      COALESCE(CASE WHEN p_locale = 'es' THEN i18n.title END, mv.title) AS title,
      mv.thumbnail_url, mv.duration_seconds,
      sv.saved_at
    FROM manual_video_saves sv
    JOIN manual_videos mv ON mv.id = sv.video_id AND mv.review_status = 'approved'
    LEFT JOIN manual_videos_i18n i18n ON i18n.video_id = mv.id AND i18n.locale = p_locale
    WHERE sv.user_id = v_uid
    ORDER BY sv.saved_at DESC
    LIMIT 3
  ) t;

  -- ── Specialists (favorites table is the saves ledger here) ──
  -- favorites table predates the saved-X pattern; created_at is the
  -- recency proxy.
  SELECT COUNT(*) INTO v_spec_count
  FROM favorites WHERE user_id = v_uid;

  SELECT jsonb_agg(t.*) INTO v_specialists FROM (
    SELECT s.id, s.full_name, s.specialty, s.photo_url, s.city, s.state,
      f.created_at AS saved_at
    FROM favorites f
    JOIN specialists s ON s.id = f.specialist_id
    WHERE f.user_id = v_uid
    ORDER BY f.created_at DESC
    LIMIT 3
  ) t;

  -- ── Milk donors ──
  SELECT COUNT(*) INTO v_donor_count
  FROM milk_saved_donors WHERE user_id = v_uid;

  SELECT jsonb_agg(t.*) INTO v_donors FROM (
    SELECT dp.id, dp.display_name, dp.avatar_url, dp.city, dp.state,
      sv.saved_at
    FROM milk_saved_donors sv
    JOIN milk_donor_profiles dp ON dp.id = sv.donor_profile_id
    WHERE sv.user_id = v_uid
    ORDER BY sv.saved_at DESC
    LIMIT 3
  ) t;

  -- ── Gear listings ──
  -- Skip sold/withdrawn statuses in the preview (the user can still see
  -- them by tapping "See all →" → SavedGearScreen which shows the full
  -- list with status badges). The dashboard surface is "things you might
  -- act on", not "everything you ever saved".
  SELECT COUNT(*) INTO v_gear_count
  FROM gear_saved_listings sv
  JOIN gear_listings gl ON gl.id = sv.listing_id
  WHERE sv.user_id = v_uid;

  SELECT jsonb_agg(t.*) INTO v_gear FROM (
    SELECT gl.id, gl.title, gl.condition, gl.price_cents, gl.is_free, gl.status,
      (SELECT image_url FROM gear_listing_images gli
        WHERE gli.listing_id = gl.id ORDER BY gli.sort_order ASC LIMIT 1) AS cover_image_url,
      sv.saved_at
    FROM gear_saved_listings sv
    JOIN gear_listings gl ON gl.id = sv.listing_id
    WHERE sv.user_id = v_uid
      AND gl.status IN ('active','pending')
    ORDER BY sv.saved_at DESC
    LIMIT 3
  ) t;

  RETURN jsonb_build_object(
    'videos',         COALESCE(v_videos,      '[]'::jsonb),
    'videos_count',   v_video_count,
    'specialists',    COALESCE(v_specialists, '[]'::jsonb),
    'specialists_count', v_spec_count,
    'donors',         COALESCE(v_donors,      '[]'::jsonb),
    'donors_count',   v_donor_count,
    'gear',           COALESCE(v_gear,        '[]'::jsonb),
    'gear_count',     v_gear_count,
    'total',          v_video_count + v_spec_count + v_donor_count + v_gear_count
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION get_saved_dashboard(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_saved_dashboard(TEXT) TO authenticated, service_role;
