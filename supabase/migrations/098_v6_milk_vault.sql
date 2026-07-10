-- 098_v6_milk_vault.sql
-- =====================================================================
-- V6 · Milk Vault — personal freezer-stash tracker + optional
-- sell/donate marketplace-planning layer.
--
-- This is DISTINCT from V2 "Milk Connect" (the peer-donor marketplace in
-- migration 004). To avoid clobbering the existing `milk_listings` and
-- `milk_transactions` tables (both owned by Milk Connect), every Vault
-- table is namespaced with the `milk_vault_` prefix.
--
-- Posture: like V2 Milk Hub and V4 Gear, the marketplace layer is
-- PLANNING-ONLY / cash-only. No Stripe, no in-app money movement. Payout
-- and value figures are estimates "for planning purposes only" (see the
-- legal copy surfaced in the app). The vault never verifies milk safety,
-- donor eligibility, or shipping compliance.
--
-- Diet / lifestyle tags (vegan, dairy-free, soy-free, caffeine-free,
-- medication-free, …) are NOT captured per-bag. They describe the mom's
-- own diet and are read from her existing profile (donor diet flags in
-- `milk_donor_diet_flags` when she has a donor profile) — never re-asked
-- when logging a bag.
-- =====================================================================

-- ── shared touch-updated-at trigger fn (search_path pinned per 051 sweep) ──
CREATE OR REPLACE FUNCTION touch_milk_vault_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- 1. milk_vault_bags — one row per logged bag of pumped milk
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS milk_vault_bags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_profile_id   UUID REFERENCES baby_profiles(id) ON DELETE SET NULL,
  ounces            NUMERIC(5,1) NOT NULL CHECK (ounces > 0 AND ounces <= 100),
  pumped_at         TIMESTAMPTZ NOT NULL,
  -- Defaults to pumped_at at the app layer when the user leaves it blank;
  -- kept NOT NULL here so downstream "oldest milk" math is never null.
  frozen_at         TIMESTAMPTZ NOT NULL,
  notes             TEXT,
  photo_url         TEXT,
  -- Raw AI extraction blob from the bag scanner (audit / re-edit).
  ai_extracted_data JSONB,
  status            TEXT NOT NULL DEFAULT 'stored'
    CHECK (status IN ('stored','reserved','available','sold','donated','used','expired')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dashboard reads filter by user + status and sort by frozen_at (oldest milk,
-- next-to-use, weekly-added windows), so index that access path.
CREATE INDEX IF NOT EXISTS idx_milk_vault_bags_user_frozen
  ON milk_vault_bags(user_id, frozen_at);
CREATE INDEX IF NOT EXISTS idx_milk_vault_bags_user_status
  ON milk_vault_bags(user_id, status);

CREATE TRIGGER trg_milk_vault_bags_touch
  BEFORE UPDATE ON milk_vault_bags
  FOR EACH ROW EXECUTE FUNCTION touch_milk_vault_updated_at();

ALTER TABLE milk_vault_bags ENABLE ROW LEVEL SECURITY;

CREATE POLICY milk_vault_bags_select_own ON milk_vault_bags
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY milk_vault_bags_insert_own ON milk_vault_bags
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY milk_vault_bags_update_own ON milk_vault_bags
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY milk_vault_bags_delete_own ON milk_vault_bags
  FOR DELETE USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════
-- 2. milk_vault_settings — one vault config row per user
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS milk_vault_settings (
  id                                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  baby_profile_id                        UUID REFERENCES baby_profiles(id) ON DELETE SET NULL,
  mode                                   TEXT NOT NULL DEFAULT 'personal_stash'
    CHECK (mode IN ('personal_stash','marketplace')),
  -- NULL until the user picks a mode on first open — the client shows the
  -- "What are you using Milk Vault for?" picker while this is NULL.
  onboarded_at                           TIMESTAMPTZ,
  average_daily_intake_oz                NUMERIC(5,1) NOT NULL DEFAULT 24
    CHECK (average_daily_intake_oz > 0),
  stash_goal_days                        INTEGER NOT NULL DEFAULT 30
    CHECK (stash_goal_days >= 0),
  desired_reserve_days                   INTEGER NOT NULL DEFAULT 30
    CHECK (desired_reserve_days >= 0),
  price_per_oz                           NUMERIC(6,2) NOT NULL DEFAULT 2.50 CHECK (price_per_oz >= 0),
  low_price_per_oz                       NUMERIC(6,2) NOT NULL DEFAULT 1.50 CHECK (low_price_per_oz >= 0),
  premium_price_per_oz                   NUMERIC(6,2) NOT NULL DEFAULT 3.50 CHECK (premium_price_per_oz >= 0),
  default_fulfillment_method             TEXT NOT NULL DEFAULT 'local_pickup'
    CHECK (default_fulfillment_method IN
      ('local_pickup','local_dropoff','ship_to_buyer','donate_locally','donate_by_shipping')),
  default_shipping_payment_responsibility TEXT NOT NULL DEFAULT 'buyer_pays'
    CHECK (default_shipping_payment_responsibility IN
      ('buyer_pays','seller_pays','split','deduct_from_payout')),
  created_at                             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_milk_vault_settings_touch
  BEFORE UPDATE ON milk_vault_settings
  FOR EACH ROW EXECUTE FUNCTION touch_milk_vault_updated_at();

ALTER TABLE milk_vault_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY milk_vault_settings_select_own ON milk_vault_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY milk_vault_settings_insert_own ON milk_vault_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY milk_vault_settings_update_own ON milk_vault_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY milk_vault_settings_delete_own ON milk_vault_settings
  FOR DELETE USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════
-- 3. milk_vault_transactions — immutable ledger of milk that left the stash
--    (sold / donated / used by baby / expired). Powers lifetime totals.
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS milk_vault_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_profile_id   UUID REFERENCES baby_profiles(id) ON DELETE SET NULL,
  -- Optional pointer back to the bag this transaction drew from.
  bag_id            UUID REFERENCES milk_vault_bags(id) ON DELETE SET NULL,
  transaction_type  TEXT NOT NULL
    CHECK (transaction_type IN ('sold','donated','used','expired')),
  ounces            NUMERIC(6,1) NOT NULL CHECK (ounces > 0),
  price_per_oz      NUMERIC(6,2),
  total_amount      NUMERIC(10,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milk_vault_tx_user_created
  ON milk_vault_transactions(user_id, created_at DESC);

ALTER TABLE milk_vault_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY milk_vault_tx_select_own ON milk_vault_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY milk_vault_tx_insert_own ON milk_vault_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY milk_vault_tx_delete_own ON milk_vault_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════
-- 4. milk_vault_listings — a planned sell/donate offer of excess milk
--    (marketplace mode only). Estimate-only; no payment is processed.
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS milk_vault_listings (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_profile_id                 UUID REFERENCES baby_profiles(id) ON DELETE SET NULL,
  ounces                          NUMERIC(7,1) NOT NULL CHECK (ounces > 0),
  price_per_oz                    NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (price_per_oz >= 0),
  fulfillment_method              TEXT NOT NULL DEFAULT 'local_pickup'
    CHECK (fulfillment_method IN
      ('local_pickup','local_dropoff','ship_to_buyer','donate_locally','donate_by_shipping')),
  shipping_payment_responsibility TEXT
    CHECK (shipping_payment_responsibility IN
      ('buyer_pays','seller_pays','split','deduct_from_payout')),
  shipping_supply_cost            NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (shipping_supply_cost >= 0),
  estimated_carrier_cost          NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (estimated_carrier_cost >= 0),
  -- Denormalized calc snapshots (see milkVaultCalc.ts for the formulas).
  milk_subtotal                   NUMERIC(10,2) NOT NULL DEFAULT 0,
  buyer_total                     NUMERIC(10,2) NOT NULL DEFAULT 0,
  seller_payout                   NUMERIC(10,2) NOT NULL DEFAULT 0,
  status                          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','matched','completed','cancelled')),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milk_vault_listings_user_status
  ON milk_vault_listings(user_id, status);

CREATE TRIGGER trg_milk_vault_listings_touch
  BEFORE UPDATE ON milk_vault_listings
  FOR EACH ROW EXECUTE FUNCTION touch_milk_vault_updated_at();

ALTER TABLE milk_vault_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY milk_vault_listings_select_own ON milk_vault_listings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY milk_vault_listings_insert_own ON milk_vault_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY milk_vault_listings_update_own ON milk_vault_listings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY milk_vault_listings_delete_own ON milk_vault_listings
  FOR DELETE USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════
-- 5. milk_vault_shipping_kits — the shipping-supply plan for a listing
--    fulfilled by shipping. One kit per listing.
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS milk_vault_shipping_kits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID NOT NULL REFERENCES milk_vault_listings(id) ON DELETE CASCADE UNIQUE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Checklist of packing supplies: [{ key, label, checked }]
  supply_items    JSONB NOT NULL DEFAULT '[]'::jsonb,
  supply_cost     NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (supply_cost >= 0),
  carrier         TEXT,
  service_level   TEXT,
  origin_zip      TEXT,
  destination_zip TEXT,
  tracking_number TEXT,
  label_url       TEXT,
  status          TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','ready','shipped','delivered','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milk_vault_kits_user
  ON milk_vault_shipping_kits(user_id);

CREATE TRIGGER trg_milk_vault_kits_touch
  BEFORE UPDATE ON milk_vault_shipping_kits
  FOR EACH ROW EXECUTE FUNCTION touch_milk_vault_updated_at();

ALTER TABLE milk_vault_shipping_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY milk_vault_kits_select_own ON milk_vault_shipping_kits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY milk_vault_kits_insert_own ON milk_vault_shipping_kits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY milk_vault_kits_update_own ON milk_vault_shipping_kits
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY milk_vault_kits_delete_own ON milk_vault_shipping_kits
  FOR DELETE USING (auth.uid() = user_id);
