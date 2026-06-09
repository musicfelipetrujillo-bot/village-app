-- 074_v4_gear_boost.sql
-- V4 Gear — paid "Boost listing" (à la carte, Gear only).
--
-- Product decision (2026-05-30): boost is a PLATFORM SERVICE FEE (user → The
-- Village for promotional placement), NOT a transaction payment between two
-- users. It therefore does NOT touch the FinCEN money-transmitter analysis that
-- drives the cash-only posture for the gear/milk *transaction* itself — the
-- listing sale stays cash/P2P, unchanged. See docs/V4_GEAR_BOOST_RUNBOOK.md and
-- docs/source/Village_Risk_and_Compliance.md §2.7.
--
-- Monetization: à la carte consumable IAP now (Apple In-App Purchase — a paid
-- in-app digital service, required by App Store Guideline 3.1.1, so it ships in
-- a NATIVE build, not an OTA), plus a future "free boosts for Pro members" perk
-- (source='pro_perk') when the V5 Pro tier lands.
--
-- Scope: GEAR ONLY. Milk is intentionally excluded — paying to surface a milk
-- donor over a safer/closer match is an ethics/optics problem we will not ship.
--
-- Security model: the client NEVER writes boost state directly. After Apple
-- validates a purchase, the `gear-boost-activate` Edge Function (service role,
-- after verifying the receipt) calls `activate_gear_boost`. The gear_boosts
-- ledger has NO client-write policy, and a UNIQUE index on the store
-- transaction id makes replays a no-op.

-- ── 1. Listing boost window ──────────────────────────────────────────────────
ALTER TABLE public.gear_listings
  ADD COLUMN IF NOT EXISTS boosted_until timestamptz;

-- Partial index: only the (few) currently-or-recently boosted rows.
CREATE INDEX IF NOT EXISTS idx_gear_listings_boosted_until
  ON public.gear_listings (boosted_until)
  WHERE boosted_until IS NOT NULL;

-- ── 2. Boost purchase ledger (audit + Pro-perk accounting + anti-replay) ──────
CREATE TABLE IF NOT EXISTS public.gear_boosts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id              uuid NOT NULL REFERENCES public.gear_listings(id) ON DELETE CASCADE,
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source                  text NOT NULL DEFAULT 'iap'  CHECK (source IN ('iap','pro_perk','promo')),
  platform                text NOT NULL DEFAULT 'ios'  CHECK (platform IN ('ios','android')),
  product_id              text,                          -- e.g. 'gear_boost_7d'
  platform_transaction_id text,                          -- Apple/RevenueCat txn id (anti-replay)
  duration_days           int  NOT NULL DEFAULT 7  CHECK (duration_days BETWEEN 1 AND 30),
  starts_at               timestamptz NOT NULL DEFAULT now(),
  expires_at              timestamptz NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Anti-replay: a given store transaction can activate at most one boost.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gear_boosts_txn
  ON public.gear_boosts (platform_transaction_id)
  WHERE platform_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gear_boosts_listing ON public.gear_boosts (listing_id);
CREATE INDEX IF NOT EXISTS idx_gear_boosts_user    ON public.gear_boosts (user_id);

ALTER TABLE public.gear_boosts ENABLE ROW LEVEL SECURITY;

-- Owner can read their own boost history. There is deliberately NO
-- INSERT/UPDATE/DELETE policy: only the service role (which bypasses RLS) writes,
-- via the Edge Function after receipt verification. A signed-in client cannot
-- fabricate a boost.
DROP POLICY IF EXISTS gear_boosts_owner_read ON public.gear_boosts;
CREATE POLICY gear_boosts_owner_read ON public.gear_boosts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.gear_boosts FROM anon;
GRANT SELECT ON public.gear_boosts TO authenticated;

-- ── 3. activate_gear_boost — service-role-only activation ─────────────────────
-- Called by the gear-boost-activate Edge Function AFTER it has verified the
-- store receipt. Stacks onto any existing window (extends from the later of now
-- or current boosted_until). The ledger INSERT throws unique_violation on a
-- replayed transaction id; the Edge Function treats that as idempotent success.
CREATE OR REPLACE FUNCTION activate_gear_boost(
  p_listing_id    uuid,
  p_user_id       uuid,
  p_source        text DEFAULT 'iap',
  p_platform      text DEFAULT 'ios',
  p_product_id    text DEFAULT NULL,
  p_transaction_id text DEFAULT NULL,
  p_duration_days int  DEFAULT 7
) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner     uuid;
  v_current   timestamptz;
  v_days      int := GREATEST(LEAST(COALESCE(p_duration_days, 7), 30), 1);
  v_new_until timestamptz;
BEGIN
  -- Lock the listing row so concurrent activations on the SAME listing
  -- serialize. Without the lock, two boosts could each read the same
  -- boosted_until and the second UPDATE would clobber the first — the buyer
  -- pays twice but only gets one window.
  SELECT seller_id, boosted_until INTO v_owner, v_current
    FROM gear_listings WHERE id = p_listing_id FOR UPDATE;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'listing not found';
  END IF;
  IF v_owner <> p_user_id THEN
    RAISE EXCEPTION 'not listing owner';
  END IF;

  v_new_until := GREATEST(now(), COALESCE(v_current, now())) + make_interval(days => v_days);

  -- Ledger row. A replayed store transaction id hits UNIQUE(platform_transaction_id);
  -- we swallow it and return the existing window so activation is idempotent
  -- (no double-extend, no error surfaced to the caller).
  BEGIN
    INSERT INTO gear_boosts (
      listing_id, user_id, source, platform, product_id,
      platform_transaction_id, duration_days, starts_at, expires_at
    ) VALUES (
      p_listing_id, p_user_id, COALESCE(p_source, 'iap'), COALESCE(p_platform, 'ios'),
      p_product_id, p_transaction_id, v_days, now(), v_new_until
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN COALESCE(v_current, now());
  END;

  UPDATE gear_listings SET boosted_until = v_new_until WHERE id = p_listing_id;
  RETURN v_new_until;
END;
$$;

-- Only the service role may activate — never anon/authenticated directly.
REVOKE ALL ON FUNCTION activate_gear_boost(uuid,uuid,text,text,text,text,int) FROM PUBLIC;
REVOKE ALL ON FUNCTION activate_gear_boost(uuid,uuid,text,text,text,text,int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION activate_gear_boost(uuid,uuid,text,text,text,text,int) TO service_role;

-- ── 4. list_gear_near — boosted-first sort + is_boosted flag ──────────────────
-- RETURNS TABLE shape changes (adds is_boosted), so DROP before CREATE.
DROP FUNCTION IF EXISTS list_gear_near(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT[], INTEGER, BOOLEAN);
CREATE OR REPLACE FUNCTION list_gear_near(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 50,
  p_category TEXT DEFAULT NULL,
  p_age_tags TEXT[] DEFAULT NULL,
  p_max_price_cents INTEGER DEFAULT NULL,
  p_include_free BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  category TEXT,
  subcategory TEXT,
  brand TEXT,
  condition TEXT,
  age_tags TEXT[],
  price_cents INTEGER,
  is_free BOOLEAN,
  currency TEXT,
  pickup_city TEXT,
  distance_km DOUBLE PRECISION,
  is_cpsc_checked BOOLEAN,
  is_boosted BOOLEAN,
  cover_image_url TEXT,
  save_count INTEGER,
  created_at TIMESTAMPTZ
) LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT
    l.id, l.title, l.category, l.subcategory, l.brand, l.condition,
    l.age_tags, l.price_cents, l.is_free, l.currency,
    l.pickup_city,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
      THEN ST_Distance(l.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000.0
    END AS distance_km,
    l.is_cpsc_checked,
    (l.boosted_until IS NOT NULL AND l.boosted_until > now()) AS is_boosted,
    (SELECT image_url FROM gear_listing_images i
       WHERE i.listing_id = l.id ORDER BY i.sort_order LIMIT 1) AS cover_image_url,
    l.save_count,
    l.created_at
  FROM gear_listings l
  WHERE l.status = 'active'
    AND (p_category IS NULL OR l.category = p_category)
    AND (p_age_tags IS NULL OR cardinality(l.age_tags) = 0 OR l.age_tags && p_age_tags)
    AND (p_max_price_cents IS NULL OR l.price_cents <= p_max_price_cents)
    AND (p_include_free = TRUE OR l.is_free = FALSE)
    AND (
      p_lat IS NULL OR p_lng IS NULL
      OR ST_DWithin(l.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000)
    )
  ORDER BY
    -- Boosted listings float to the top of the result window.
    (l.boosted_until IS NOT NULL AND l.boosted_until > now()) DESC,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
      THEN ST_Distance(l.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
      ELSE 0
    END,
    l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION list_gear_near(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT[], INTEGER, BOOLEAN) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION list_gear_near(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT[], INTEGER, BOOLEAN) FROM anon;

-- ── 5. get_gear_listing — add boosted_until (owner sees expiry) ───────────────
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
  reference_image_url TEXT,
  boosted_until TIMESTAMPTZ,
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
    l.reference_image_url,
    l.boosted_until,
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

GRANT EXECUTE ON FUNCTION get_gear_listing(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION get_gear_listing(UUID) FROM anon;

-- ── 6. list_my_gear_listings — add boosted_until so the owner sees state ──────
DROP FUNCTION IF EXISTS list_my_gear_listings();
CREATE OR REPLACE FUNCTION list_my_gear_listings()
RETURNS TABLE (
  id UUID, title TEXT, category TEXT, status TEXT,
  price_cents INTEGER, is_free BOOLEAN, currency TEXT,
  view_count INTEGER, save_count INTEGER,
  created_at TIMESTAMPTZ,
  cover_image_url TEXT,
  boosted_until TIMESTAMPTZ
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    l.id, l.title, l.category, l.status,
    l.price_cents, l.is_free, l.currency,
    l.view_count, l.save_count, l.created_at,
    (SELECT image_url FROM gear_listing_images i
       WHERE i.listing_id = l.id ORDER BY i.sort_order LIMIT 1) AS cover_image_url,
    l.boosted_until
  FROM gear_listings l
  WHERE l.seller_id = auth.uid()
  ORDER BY l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION list_my_gear_listings() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION list_my_gear_listings() FROM anon;
