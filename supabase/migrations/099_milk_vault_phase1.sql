-- 099_milk_vault_phase1.sql
--
-- Milk Vault — a personal breastmilk freezer-stash tracker. Phase 1 ships the
-- data layer for BOTH modes but the app only surfaces Personal Stash Mode for now;
-- Marketplace Mode (keep-vs-sell slider, listings, shipping) is scaffolded behind a
-- flag and built in a later phase.
--
-- This is intentionally numbered 099 (not 098): migration 098
-- (098_retire_milk_stripe_connect.sql) is already committed on the Stripe-retirement
-- branch and awaiting apply. Numbering this 099 avoids a version collision when both land.
--
-- SCOPE (Phase 1):
--   • milk_bags           — one row per stored milk bag (ounces + pumped/frozen dates + notes)
--   • milk_vault_settings — one row per user: mode + intake/goal/reserve + (future) pricing
--
-- NOT created here (Phase 2 / Marketplace — deferred to avoid name collisions with the
-- retired donor-marketplace tables that 098 drops): milk_listings, milk_transactions,
-- milk_shipping_kits. When built they will be namespaced milk_vault_* so they can never
-- clash with the old Stripe-era tables.
--
-- LIFESTYLE/DIET: per the product spec, diet/lifestyle tags (vegan, dairy-free, …) come
-- from the parent's existing profile and are NOT stored per-bag. Personal Stash Mode does
-- not use them; Marketplace Mode will source them from the parent profile in Phase 2.
--
-- Both tables are strictly owner-scoped (a mom only ever sees her own stash), following the
-- own-row RLS pattern established for milk in migrations 004/005.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. milk_bags — the freezer stash ledger
-- ─────────────────────────────────────────────────────────────
create table if not exists milk_bags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_id           UUID REFERENCES baby_profiles(id) ON DELETE SET NULL,
  ounces            DECIMAL(6,2) NOT NULL CHECK (ounces > 0),
  pumped_at         DATE NOT NULL,
  -- Defaulted to pumped_at at the app layer when the user leaves it blank.
  frozen_at         DATE NOT NULL,
  notes             TEXT,
  photo_url         TEXT,
  -- Raw AI bag-scanner extraction (ounces/dates/notes it read), kept for auditing +
  -- letting the user see what was auto-filled. NULL for manual entries.
  ai_extracted_data JSONB,
  status            VARCHAR(20) NOT NULL DEFAULT 'stored'
    CHECK (status IN ('stored','reserved','available','sold','donated','used','expired')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboard reads are all "my bags, optionally by status, ordered by frozen_at".
create index if not exists idx_milk_bags_user_status
  on milk_bags (user_id, status);
create index if not exists idx_milk_bags_user_frozen
  on milk_bags (user_id, frozen_at);

alter table milk_bags enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 2. milk_vault_settings — one row per user (mode + planning inputs)
-- ─────────────────────────────────────────────────────────────
create table if not exists milk_vault_settings (
  id                                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  baby_id                                UUID REFERENCES baby_profiles(id) ON DELETE SET NULL,
  -- Chosen on first open ("What are you using Milk Vault for?"). The EXISTENCE of this row
  -- means the user has onboarded; no row => show the mode picker.
  mode                                   VARCHAR(20) NOT NULL DEFAULT 'personal_stash'
    CHECK (mode IN ('personal_stash','marketplace')),
  average_daily_intake_oz                DECIMAL(6,2) NOT NULL DEFAULT 24,
  stash_goal_days                        INTEGER NOT NULL DEFAULT 30,
  desired_reserve_days                   INTEGER NOT NULL DEFAULT 30,
  -- Pricing + fulfillment are Marketplace-only planning inputs (unused in Personal Stash).
  price_per_oz                           DECIMAL(6,2) NOT NULL DEFAULT 2.50,
  low_price_per_oz                       DECIMAL(6,2) NOT NULL DEFAULT 2.00,
  premium_price_per_oz                   DECIMAL(6,2) NOT NULL DEFAULT 3.00,
  default_fulfillment_method             VARCHAR(30) NOT NULL DEFAULT 'local_pickup'
    CHECK (default_fulfillment_method IN
      ('local_pickup','local_dropoff','ship_to_buyer','donate_locally','donate_by_shipping')),
  default_shipping_payment_responsibility VARCHAR(30) NOT NULL DEFAULT 'buyer_pays'
    CHECK (default_shipping_payment_responsibility IN
      ('buyer_pays','seller_pays','split','deduct_from_payout')),
  created_at                             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

alter table milk_vault_settings enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 3. updated_at triggers (reuse the shared milk helper from migration 004)
-- ─────────────────────────────────────────────────────────────
create or replace function update_milk_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_milk_bags_updated_at on milk_bags;
create trigger trg_milk_bags_updated_at
  before update on milk_bags
  for each row execute function update_milk_updated_at();

drop trigger if exists trg_milk_vault_settings_updated_at on milk_vault_settings;
create trigger trg_milk_vault_settings_updated_at
  before update on milk_vault_settings
  for each row execute function update_milk_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. RLS — strictly owner-scoped (a mom only sees her own stash)
-- ─────────────────────────────────────────────────────────────
create policy "milk_bags_select_own" on milk_bags
  for select to authenticated using (auth.uid() = user_id);
create policy "milk_bags_write_own" on milk_bags
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "milk_bags_service" on milk_bags
  for all to service_role using (true) with check (true);

create policy "milk_vault_settings_select_own" on milk_vault_settings
  for select to authenticated using (auth.uid() = user_id);
create policy "milk_vault_settings_write_own" on milk_vault_settings
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "milk_vault_settings_service" on milk_vault_settings
  for all to service_role using (true) with check (true);

commit;

-- ── Verification (run after apply) ──
-- select to_regclass('public.milk_bags'), to_regclass('public.milk_vault_settings'); -- both non-null
-- select relrowsecurity from pg_class where relname in ('milk_bags','milk_vault_settings'); -- both true
