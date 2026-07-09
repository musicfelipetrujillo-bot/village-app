-- 096_privacy_drop_milk_donor_pii.sql
--
-- Data minimization (follow-up to 095). The Village is a CONNECTOR between milk donors
-- and moms — it does NOT process milk transactions (cash-only, off-platform handoff). So a
-- donor's home address + phone are data we should not hold at all. "The cheapest PII to
-- protect is the PII you don't store."
--
-- address_line, phone, and the get_transaction_pickup_address RPC exist only because of the
-- deprecated M3/M5 Stripe purchase + Shippo shipping flow (migration 018), which is dormant
-- under cash-only. 0 rows carry an address. Migration 095 locked these columns down; this
-- migration removes them entirely.
--
-- APP SIDE (ships in the same release): getTransactionAddress() is now a null-returning stub
-- (the RPC is gone); the dormant MilkOrderConfirmScreen degrades to showing no pickup address.
--
-- NOT dropped here: stripe_account_id / stripe_onboarding_complete. Those are wired into the
-- (flag-off) listing gate + StripeOnboardingScreen and need a separate "retire Stripe Connect
-- from Milk" pass before removal.

begin;

-- The only server-side reader of address_line/phone — drop it before the columns.
drop function if exists public.get_transaction_pickup_address(uuid);

alter table public.milk_donor_profiles
  drop column if exists address_line,
  drop column if exists phone;

commit;

-- ── Verification (after apply) — expect 0 rows ──
-- select column_name
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'milk_donor_profiles'
--    and column_name in ('address_line', 'phone');
