-- 095_security_milk_donor_pii_column_revoke.sql
--
-- Fixes appsec finding C-1 (docs/audits/appsec-2026-07-07.md):
-- milk_donor_profiles exposes donor HOME ADDRESS + PHONE to every authenticated user.
--
-- Root cause: the SELECT RLS policy `milk_donor_profiles_select_active`
-- (qual: is_active = true) grants row read to the `authenticated` role, and
-- Postgres RLS is ROW-level, not COLUMN-level. The `authenticated` role holds
-- table-wide SELECT, so a direct PostgREST query
--   /rest/v1/milk_donor_profiles?is_active=eq.true&select=display_name,address_line,phone
-- returns every active donor's address_line + phone. The intended access path is the
-- SECURITY DEFINER RPC `get_transaction_pickup_address(uuid)`, which stays a "front door"
-- while the table read is an open "back door".
--
-- Confirmed live on 2026-07-07: has_column_privilege('authenticated', ...,'address_line','SELECT') = true.
-- Currently 0 active rows carry an address (pre-launch) — so this is a zero-exposure,
-- pre-launch fix. Close it before real donor PII lands.
--
-- Fix: column-level REVOKE of the two sensitive PII columns from the client-facing roles.
-- SECURITY DEFINER RPCs run as the function owner, NOT the caller, so
-- get_transaction_pickup_address() continues to return the address to the RPC's
-- authorized callers (buyer of a confirmed transaction) unaffected.
--
-- Client-read impact (verified against apps/mobile/src):
--   * getMyDonorProfile() / createDonorProfile() / updateDonorProfile() use .select('*') /
--     .select() (all columns). A column REVOKE is ROLE-level, so it blocks the OWNER too:
--     PostgREST would 403 "permission denied for column address_line". In cash-only mode
--     the donor editor never collects address_line/phone (createDonorProfile payload is
--     display_name/city/state/zip_code/bio only — those two columns are written solely by
--     the deprecated Stripe transaction flow, migration 018). So the COMPANION FIX is small:
--     change those three api/milk.ts calls from select('*')/select() to an explicit column
--     list that omits address_line + phone. >>> This migration MUST ship together with that
--     api/milk.ts change, or the donor-profile screens break. If shipping separately, hold.
--   * MilkShippingLabelScreen reads donor.address_line/phone — DORMANT (cash-only since
--     2026-05-21; Stripe shipping path is deprecated). No live impact.
--
-- NOT revoked here (flagged for a follow-up decision, not done in this migration):
--   * lat / lng (precise coordinates) — also sensitive, but the donor map/search path may
--     read them. Verify search_donors_near (SECURITY DEFINER) supplies coordinates and that
--     no client does a direct .select('lat,lng') before revoking. Tracked separately.
--   * social_links — intentionally public (self-attested social proof). Keep readable.

-- IMPORTANT: a column-level `REVOKE SELECT (col)` is a NO-OP when the role already holds a
-- TABLE-wide SELECT grant. Supabase issues `GRANT SELECT ON ALL TABLES IN SCHEMA public TO
-- authenticated, anon` by default, so both roles have SELECT on EVERY column via the table
-- grant — and you cannot subtract a single column from a table grant. (Verified live
-- 2026-07-08: after a plain column REVOKE, has_column_privilege(...,'address_line') was still
-- true.) The correct fix is to drop the table-wide SELECT and re-grant SELECT on only the
-- non-sensitive columns. The SECURITY DEFINER RPC keeps working (runs as owner, not caller);
-- INSERT/UPDATE grants are untouched so donors can still write their own profile.
--
-- NOTE: because SELECT is now an explicit column allowlist, any NEW column added to this table
-- later must be added to these grants (and the api/milk.ts DONOR_SELECT_COLUMNS list) or
-- authenticated reads of it will 403.

begin;

-- authenticated: table-wide SELECT -> column-scoped SELECT (omits address_line, phone)
revoke select on public.milk_donor_profiles from authenticated;
grant select (
  id, user_id, display_name, avatar_url, neighborhood, city, state, zip_code,
  lat, lng, bio, price_per_oz, supply_oz_available, is_active, is_verified,
  stripe_account_id, stripe_onboarding_complete, created_at, updated_at,
  rating_avg, review_count, social_links
) on public.milk_donor_profiles to authenticated;

-- anon has no SELECT RLS policy (sees 0 rows) but held the column grant; mirror the scope.
revoke select on public.milk_donor_profiles from anon;
grant select (
  id, user_id, display_name, avatar_url, neighborhood, city, state, zip_code,
  lat, lng, bio, price_per_oz, supply_oz_available, is_active, is_verified,
  stripe_account_id, stripe_onboarding_complete, created_at, updated_at,
  rating_avg, review_count, social_links
) on public.milk_donor_profiles to anon;

commit;

-- ── Verification (run after apply) ──
-- select
--   has_column_privilege('authenticated','public.milk_donor_profiles','address_line','SELECT') as auth_addr,
--   has_column_privilege('authenticated','public.milk_donor_profiles','phone','SELECT')        as auth_phone,
--   has_column_privilege('authenticated','public.milk_donor_profiles','display_name','SELECT') as auth_display_ok;
--
-- Expected: auth_addr = FALSE, auth_phone = FALSE, auth_display_ok = TRUE.
-- Then confirm the RPC still works for an authorized caller:
-- select * from get_transaction_pickup_address('<a confirmed transaction id>');
