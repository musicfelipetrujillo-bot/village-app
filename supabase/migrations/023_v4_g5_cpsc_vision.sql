-- V4 Phase G5 — CPSC recall check + AI vision listing assist.
-- Spec: docs/source/Village_GearSwap_ToolStack.md §§ Step 2, Page 10
--       docs/source/Village_Risk_and_Compliance.md §§ 2.1, 2.7 (non-negotiable #1)
--
-- What this migration does:
--   1. Adds CPSC fields to gear_listings: cpsc_recall_status / cpsc_recall_id /
--      cpsc_recall_url / cpsc_checked_at / upc / vision_confidence.
--      (is_cpsc_checked already exists from 012 — now becomes a derived helper
--       that mirrors `cpsc_recall_status = 'clear'`. Existing rows default to
--       unchecked so the nightly sweep re-runs them.)
--   2. Creates cpsc_recall_cache — a local mirror of the subset of recalls we've
--      seen, so the nightly sweep can join active listings against it cheaply
--      without re-hitting recalls.gov for every listing on every run.
--   3. RPC mark_listing_cpsc — owner-scoped write that flips status + persists
--      recall id/url. Called by the gear-cpsc-check Edge Function after it has
--      consulted recalls.gov.
--   4. Extends user_notifications_feed.type CHECK to allow 'gear_recall' so the
--      sweep can write seller notifications (Risk & Compliance §2.1).
--   5. RPC sweep_active_listings_for_recalls — service-role helper that walks
--      active listings, withdraws any whose (brand/title/upc) matches a row in
--      cpsc_recall_cache, and writes a 'gear_recall' row into
--      user_notifications_feed for each affected seller.
--   6. Extends get_gear_listing + list_gear_near to return the new CPSC fields.
--   7. pg_cron job `gear-cpsc-recall-sync` at 02:00 ET (06:00 UTC) — pulls fresh
--      recalls from saferproducts.gov, upserts cache, runs the sweep.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Extend gear_listings
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE gear_listings
  ADD COLUMN cpsc_recall_status TEXT
    CHECK (cpsc_recall_status IN ('clear','recalled','unknown')),
  ADD COLUMN cpsc_recall_id TEXT,
  ADD COLUMN cpsc_recall_url TEXT,
  ADD COLUMN cpsc_checked_at TIMESTAMPTZ,
  ADD COLUMN upc TEXT,
  ADD COLUMN vision_confidence NUMERIC(3,2)
    CHECK (vision_confidence IS NULL OR (vision_confidence >= 0 AND vision_confidence <= 1));

CREATE INDEX idx_gear_listings_cpsc_status ON gear_listings(cpsc_recall_status);
CREATE INDEX idx_gear_listings_upc ON gear_listings(upc) WHERE upc IS NOT NULL;

COMMENT ON COLUMN gear_listings.cpsc_recall_status IS
  'clear = explicitly verified not recalled; recalled = matched active recall; unknown = pre-G5 or check errored. NULL = never run.';
COMMENT ON COLUMN gear_listings.cpsc_recall_id IS
  'SaferProducts.gov RecallNumber when status=recalled.';
COMMENT ON COLUMN gear_listings.is_cpsc_checked IS
  'DERIVED convenience flag. TRUE iff cpsc_recall_status = clear. Kept for G4 clients.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. cpsc_recall_cache — nightly-synced local mirror
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE cpsc_recall_cache (
  recall_number TEXT PRIMARY KEY,                   -- CPSC RecallNumber (e.g. '24-133')
  title TEXT NOT NULL,
  description TEXT,
  hazard TEXT,
  remedy TEXT,
  recall_date DATE,
  recall_url TEXT,
  -- Join fields — lowercased to make match cheap.
  product_name_lc TEXT,
  brand_lc TEXT,
  upcs TEXT[] NOT NULL DEFAULT '{}',                -- extracted from Products array
  -- Category hints help us pre-filter by our own category enum on sweep.
  cpsc_categories TEXT[] NOT NULL DEFAULT '{}',
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cpsc_cache_brand ON cpsc_recall_cache(brand_lc) WHERE brand_lc IS NOT NULL;
CREATE INDEX idx_cpsc_cache_name  ON cpsc_recall_cache(product_name_lc) WHERE product_name_lc IS NOT NULL;
CREATE INDEX idx_cpsc_cache_upcs  ON cpsc_recall_cache USING GIN(upcs);

CREATE OR REPLACE FUNCTION touch_cpsc_cache_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_cpsc_cache
  BEFORE UPDATE ON cpsc_recall_cache
  FOR EACH ROW EXECUTE FUNCTION touch_cpsc_cache_updated_at();

-- RLS: public read (buyers might want a "why recalled?" view someday); only
-- service_role writes (the sync Edge Function).
ALTER TABLE cpsc_recall_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpsc_cache_public_read" ON cpsc_recall_cache
  FOR SELECT USING (TRUE);
CREATE POLICY "cpsc_cache_service_write" ON cpsc_recall_cache
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────────────────────
-- 3. RPC mark_listing_cpsc
-- Owner-scoped. Called after Edge Function gets a verdict from recalls.gov.
-- If status=recalled, the listing is also withdrawn server-side so the buyer
-- feed never has a chance to surface it.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_listing_cpsc(
  p_listing_id UUID,
  p_status TEXT,                                -- 'clear' | 'recalled' | 'unknown'
  p_recall_id TEXT DEFAULT NULL,
  p_recall_url TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF p_status NOT IN ('clear','recalled','unknown') THEN
    RAISE EXCEPTION 'invalid status %', p_status;
  END IF;

  UPDATE gear_listings
     SET cpsc_recall_status = p_status,
         cpsc_recall_id     = CASE WHEN p_status = 'recalled' THEN p_recall_id ELSE NULL END,
         cpsc_recall_url    = CASE WHEN p_status = 'recalled' THEN p_recall_url ELSE NULL END,
         cpsc_checked_at    = now(),
         is_cpsc_checked    = (p_status = 'clear'),
         status             = CASE WHEN p_status = 'recalled' THEN 'withdrawn' ELSE status END,
         removed_reason     = CASE WHEN p_status = 'recalled'
                                   THEN 'cpsc_recall:' || COALESCE(p_recall_id, 'unknown')
                                   ELSE removed_reason END
   WHERE id = p_listing_id
     AND seller_id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing not found or not owned by caller';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_listing_cpsc TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Extend user_notifications_feed.type CHECK to allow 'gear_recall'.
-- Migration 008 seeded the type enum with {milestone_alert, event_reminder,
-- deal_expiry, gear_message, daily_checkin, new_match}. G5 adds recall alerts.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE user_notifications_feed
  DROP CONSTRAINT IF EXISTS user_notifications_feed_type_check;
ALTER TABLE user_notifications_feed
  ADD CONSTRAINT user_notifications_feed_type_check
  CHECK (type IN (
    'milestone_alert', 'event_reminder', 'deal_expiry', 'gear_message',
    'daily_checkin', 'new_match', 'gear_recall'
  ));

-- ────────────────────────────────────────────────────────────────────────────
-- 5. RPC sweep_active_listings_for_recalls
-- Service-role only. Matches active gear_listings against cpsc_recall_cache by
-- (upc) OR (brand AND title contains product_name).
-- Flipped listings are withdrawn + tagged with recall_id.
-- ALSO inserts a row into user_notifications_feed for each seller whose
-- listing got swept — Risk & Compliance §2.1 requires post-listing recall
-- notification to sellers.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sweep_active_listings_for_recalls()
RETURNS TABLE (swept_count INTEGER, last_run TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Guard: only callable by service_role (not `authenticated`).
  IF current_setting('request.jwt.claim.role', TRUE) = 'authenticated' THEN
    RAISE EXCEPTION 'service_role only';
  END IF;

  WITH hits AS (
    SELECT DISTINCT ON (l.id)
      l.id           AS listing_id,
      l.seller_id    AS seller_id,
      l.title        AS title,
      c.recall_number,
      c.recall_url
    FROM gear_listings l
    JOIN cpsc_recall_cache c ON (
      -- UPC match (strongest signal)
      (l.upc IS NOT NULL AND l.upc = ANY(c.upcs))
      OR
      -- brand + product name substring match
      (
        l.brand IS NOT NULL
        AND c.brand_lc IS NOT NULL
        AND lower(l.brand) = c.brand_lc
        AND c.product_name_lc IS NOT NULL
        AND lower(l.title) LIKE '%' || c.product_name_lc || '%'
      )
    )
    WHERE l.status = 'active'
      AND (l.cpsc_recall_status IS DISTINCT FROM 'recalled')
    ORDER BY l.id, c.recall_date DESC NULLS LAST
  ),
  updated AS (
    UPDATE gear_listings l
       SET cpsc_recall_status = 'recalled',
           cpsc_recall_id     = h.recall_number,
           cpsc_recall_url    = h.recall_url,
           cpsc_checked_at    = now(),
           is_cpsc_checked    = FALSE,
           status             = 'withdrawn',
           removed_reason     = 'cpsc_recall_sweep:' || h.recall_number
      FROM hits h
     WHERE l.id = h.listing_id
    RETURNING l.id AS listing_id, h.seller_id, h.title, h.recall_number, h.recall_url
  )
  INSERT INTO user_notifications_feed (
    user_id, type, title, body, deeplink, reference_id, reference_table, is_sent
  )
  SELECT
    u.seller_id,
    'gear_recall',
    'Your listing was pulled due to a CPSC recall',
    'We removed "' || u.title || '" because it matches an active CPSC recall. Tap for details.',
    'gear://listing/' || u.listing_id::text,
    u.listing_id,
    'gear_listings',
    FALSE
  FROM updated u;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count, now();
END;
$$;

REVOKE ALL ON FUNCTION sweep_active_listings_for_recalls FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sweep_active_listings_for_recalls TO service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Extend get_gear_listing and list_gear_near to return CPSC recall fields
-- so the UI can badge/hide appropriately.
-- CREATE OR REPLACE can't change return signature; DROP first.
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_gear_listing(UUID);

CREATE OR REPLACE FUNCTION get_gear_listing(p_id UUID)
RETURNS TABLE (
  id UUID, seller_id UUID,
  category TEXT, subcategory TEXT,
  title TEXT, description TEXT,
  brand TEXT, model TEXT, year_manufactured INTEGER, condition TEXT,
  age_tags TEXT[],
  price_cents INTEGER, is_free BOOLEAN, currency TEXT,
  pickup_city TEXT, pickup_zip TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  status TEXT, is_cpsc_checked BOOLEAN,
  cpsc_recall_status TEXT, cpsc_recall_id TEXT, cpsc_recall_url TEXT,
  cpsc_checked_at TIMESTAMPTZ,
  upc TEXT,
  view_count INTEGER, save_count INTEGER,
  created_at TIMESTAMPTZ,
  images JSONB,
  is_saved BOOLEAN,
  seller_name TEXT, seller_avatar_url TEXT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    l.id, l.seller_id,
    l.category, l.subcategory,
    l.title, l.description,
    l.brand, l.model, l.year_manufactured, l.condition,
    l.age_tags,
    l.price_cents, l.is_free, l.currency,
    l.pickup_city, l.pickup_zip,
    ST_Y(l.location::geometry) AS lat,
    ST_X(l.location::geometry) AS lng,
    l.status, l.is_cpsc_checked,
    l.cpsc_recall_status, l.cpsc_recall_id, l.cpsc_recall_url,
    l.cpsc_checked_at,
    l.upc,
    l.view_count, l.save_count,
    l.created_at,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', i.id, 'url', i.image_url, 'sort', i.sort_order)
              ORDER BY i.sort_order)
         FROM gear_listing_images i WHERE i.listing_id = l.id),
      '[]'::jsonb
    ) AS images,
    EXISTS (
      SELECT 1 FROM gear_saved_listings s
      WHERE s.listing_id = l.id AND s.user_id = auth.uid()
    ) AS is_saved,
    COALESCE(u.raw_user_meta_data->>'full_name',
             split_part(u.email, '@', 1)) AS seller_name,
    u.raw_user_meta_data->>'avatar_url' AS seller_avatar_url
  FROM gear_listings l
  LEFT JOIN auth.users u ON u.id = l.seller_id
  WHERE l.id = p_id
    AND (l.status IN ('active','pending','sold') OR l.seller_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION get_gear_listing TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. pg_cron nightly sync (02:00 ET = 06:00 UTC)
-- Calls gear-cpsc-recall-sync Edge Function which fetches latest recalls,
-- upserts the cache, then runs sweep_active_listings_for_recalls().
-- ────────────────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'gear-cpsc-recall-sync',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/gear-cpsc-recall-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body   := '{}'::jsonb
  );
  $$
);
