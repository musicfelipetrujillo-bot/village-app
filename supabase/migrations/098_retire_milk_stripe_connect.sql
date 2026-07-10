-- 098_retire_milk_stripe_connect.sql
--
-- Retires the deprecated Milk Stripe Connect / paid-purchase / shipping / dispute
-- subsystem. The Village's Milk Hub is CASH-ONLY / connector-only (see
-- memory/project_milk_cash_only.md, decided 2026-05-21): The Village connects milk
-- donors and moms and is NOT a party to the transaction. Payment, if any, is arranged
-- off-platform (cash / P2P) at handoff. Everything below is dead code that existed only
-- for the M3 (Stripe purchase) / M5 (Shippo shipping + disputes) flow, which has been
-- gated OFF (EXPO_PUBLIC_MILK_STRIPE_ENABLED, default off) since the cash-only pivot.
--
-- Follows the plan flagged in migration 096's header ("stripe_account_id /
-- stripe_onboarding_complete ... need a separate 'retire Stripe Connect from Milk' pass
-- before removal"). This is that pass.
--
-- WHAT THIS DROPS
--   Columns on milk_donor_profiles:
--     • stripe_account_id           (donor's Stripe Connect account — never used cash-only)
--     • stripe_onboarding_complete  (Connect onboarding gate — never used cash-only)
--   Tables (FK children of milk_transactions, dropped first):
--     • milk_shipping_labels        (Shippo labels — M5, shipping never offered cash-only)
--     • milk_disputes               (transaction disputes — M5, no transactions to dispute)
--     • milk_reviews                (see REVIEW-FLOW DECISION below)
--     • milk_transactions           (the paid-purchase ledger — empty under cash-only)
--   RPCs that read the doomed tables:
--     • list_my_orders(uuid)            (order history — reads milk_transactions)
--     • list_reviewable_orders(uuid)    (reads milk_transactions + milk_reviews)
--     • get_dispute_for_transaction(uuid)
--   Trigger functions orphaned once their tables are gone:
--     • decrement_listing_supply()      (trigger was on milk_transactions)
--     • mark_transaction_disputed()     (trigger was on milk_disputes)
--     • update_donor_rating()           (trigger was on milk_reviews)
--
-- REVIEW-FLOW DECISION — retire, do NOT rework to donor-scoped.
--   milk_reviews.transaction_id is a NOT NULL + UNIQUE FK to milk_transactions: EVERY
--   review is anchored to a completed transaction. Cash-only means there are zero
--   transactions (and never will be), so the entire review write path is a dead end:
--   list_reviewable_orders() -> MilkReviewSubmitScreen -> submitMilkReview() can never
--   produce a row. milk_reviews is therefore guaranteed empty. Reworking reviews to be
--   donor-scoped (anyone rates any donor with no transaction gate) is a NEW product
--   surface with real trust/abuse implications — fake reviews, competitor sabotage, no
--   "did you actually receive milk from this donor" verification. That is a product +
--   trust decision, not a mechanical retirement, so it is DEFERRED, not done here. This
--   migration retires the review subsystem entirely.
--
-- NOT DROPPED (intentionally out of scope):
--   • milk_donor_profiles.rating_avg / review_count — display columns read across the
--     donor search/card UI. They freeze at their current values (0 for every donor, since
--     no reviews exist). Removing them would ripple through DonorSearchResult and the card
--     components; left for a separate cleanup if desired.
--   • specialists.stripe_account_id — V1 Specialist booking still uses Stripe (see
--     memory/project_milk_cash_only.md: "Stripe is ONLY used by V1 Specialist booking
--     now"). Untouched.
--   • milk-match-donors edge function / its RPC — the AI donor-ranking path is
--     transaction-free and not part of Stripe Connect; retained.
--
-- APP SIDE (ships in the same release / this PR):
--   • MilkDonorProfile interface + DONOR_SELECT_COLUMNS drop the two stripe columns.
--   • The dead purchase/onboarding/dispute/shipping/order/review screens are removed
--     (StripeOnboarding, MilkPurchase, MilkOrderConfirm, MilkMatch, MilkOrders,
--     MilkReviewSubmit, MilkDisputeOpen, MilkShippingLabel) along with their api/milk.ts
--     functions + types and all nav references.
--
-- DEPLOYED EDGE FUNCTIONS TO DELETE (cannot be done from a migration — founder runs
--   `supabase functions delete <name>` after this lands):
--     milk-stripe-connect, milk-purchase-intent, milk-purchase-confirmed,
--     milk-dispute-open, milk-shippo-label
--
-- SAFETY: every drop is guarded IF EXISTS, and the DO block below ABORTS the whole
-- transaction if any of the four tables somehow holds a row (cash-only invariant check) —
-- so applying this against an unexpected non-empty DB fails loudly instead of destroying
-- data.

begin;

-- ── Cash-only invariant guard — abort if any doomed table holds data ──
do $$
declare
  n bigint;
  tbl text;
begin
  foreach tbl in array array[
    'public.milk_transactions',
    'public.milk_shipping_labels',
    'public.milk_disputes',
    'public.milk_reviews'
  ] loop
    if to_regclass(tbl) is not null then
      execute format('select count(*) from %s', tbl) into n;
      if n > 0 then
        raise exception
          'ABORT 098: % holds % row(s). Cash-only invariant says this must be 0 — investigate before retiring milk transactions/reviews.',
          tbl, n;
      end if;
    end if;
  end loop;
end $$;

-- ── 1. Drop RPCs that read the doomed tables ──
drop function if exists public.list_my_orders(uuid);
drop function if exists public.list_reviewable_orders(uuid);
drop function if exists public.get_dispute_for_transaction(uuid);

-- ── 2. Drop the donor Stripe Connect columns ──
alter table public.milk_donor_profiles
  drop column if exists stripe_account_id,
  drop column if exists stripe_onboarding_complete;

-- ── 3. Drop transaction-dependent tables (FK children first, then parent).
--       Each table's own triggers drop automatically with the table. ──
drop table if exists public.milk_shipping_labels;
drop table if exists public.milk_disputes;
drop table if exists public.milk_reviews;
drop table if exists public.milk_transactions;

-- ── 4. Drop trigger functions now orphaned (their triggers went with the tables) ──
drop function if exists public.decrement_listing_supply();
drop function if exists public.mark_transaction_disputed();
drop function if exists public.update_donor_rating();

commit;

-- ── Verification (run after apply) — every result should confirm the object is gone ──
-- select to_regclass('public.milk_transactions')   as milk_transactions,    -- expect NULL
--        to_regclass('public.milk_shipping_labels') as milk_shipping_labels, -- expect NULL
--        to_regclass('public.milk_disputes')        as milk_disputes,        -- expect NULL
--        to_regclass('public.milk_reviews')         as milk_reviews;         -- expect NULL
-- select column_name
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'milk_donor_profiles'
--    and column_name in ('stripe_account_id', 'stripe_onboarding_complete'); -- expect 0 rows
-- select proname from pg_proc
--  where proname in ('list_my_orders','list_reviewable_orders','get_dispute_for_transaction',
--                    'decrement_listing_supply','mark_transaction_disputed','update_donor_rating'); -- expect 0 rows
