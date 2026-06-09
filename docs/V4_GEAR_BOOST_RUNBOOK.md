# V4 Gear — Boost Listing Runbook

Paid "Boost listing" for the **Baby Gear** marketplace. Decided 2026-05-30.

## TL;DR

- **What:** a seller pays a one-off fee to float their gear listing to the top of browse for 7 days, with a "Boosted" badge.
- **Model:** à la carte consumable In-App Purchase now (`gear_boost_7d`, ~$2.99 / 7 days). Later, **Pro members get free boosts** as a subscription perk (V5 5.3) — the `source='pro_perk'` path is stubbed but rejected server-side until Pro ships.
- **Scope:** Gear only. **Milk is intentionally excluded** — paying to surface a milk donor over a safer/closer match is an ethics/optics problem we will not ship.
- **Why it's a native build, not an OTA:** boost is a paid in-app **digital service**, so Apple requires **In-App Purchase / StoreKit** (Guideline 3.1.1). StoreKit is a native module → it ships in **Build 14**, not an OTA.
- **Status:** schema, ranking, badges, Boost screen, activation Edge Function, and the feature flag are all built and `tsc`-clean. The only remaining work is the native StoreKit SDK + App Store Connect / RevenueCat config (this doc) and applying migration 074 to hosted.

## Compliance posture (important)

The cash-only rule for Gear/Milk exists to avoid **FinCEN money-transmitter** classification, which is triggered by transmitting *transaction funds between two users* (buyer → seller). A **boost fee is money flowing user → The Village for a promotional service** — ordinary platform revenue (cf. Bumble Spotlight, eBay Promoted Listings). It does **not** touch the money-transmitter analysis. The listing sale itself stays cash/P2P, unchanged.

The Boost screen states this explicitly: boost promotes *placement only*, it does not change the in-person/cash handoff and is not an endorsement of the item. (See `BoostListingScreen.tsx` fine print.) Run the final boost copy past counsel with the rest of the Gear Addendum review, but no new money-transmitter exposure is created.

## What's already built (in tree)

| Piece | File | Notes |
|---|---|---|
| Schema + ranking | `supabase/migrations/074_v4_gear_boost.sql` | `gear_listings.boosted_until`, `gear_boosts` ledger (service-role-write only, UNIQUE txn id anti-replay), `activate_gear_boost` RPC (service-role only), boosted-first sort + `is_boosted`/`boosted_until` on `list_gear_near` / `get_gear_listing` / `list_my_gear_listings`. **NOT yet applied to hosted.** |
| Client API | `apps/mobile/src/api/gear.ts` | `activateGearBoost`, `isListingBoosted`, `boostRemainingLabel`; boost fields added (optional → old backends degrade cleanly). |
| Purchase module | `apps/mobile/src/lib/boost.ts` | `GEAR_BOOST` config, `isGearBoostEnabled()`, `purchaseGearBoost()` (stub that throws `BoostUnavailableError` until the SDK lands — **no native import at module scope**). |
| Offer screen | `apps/mobile/src/screens/gear/BoostListingScreen.tsx` | Modal; already-boosted state; compliance fine print. |
| Entry points | `MyListingsScreen.tsx` (Boost action + Boosted pill), `GearListingDetailScreen.tsx` (owner Boost CTA + public badge), `GearBrowseScreen.tsx` (Boosted badge overlay). All gated on `isGearBoostEnabled()`. |
| Activation | `supabase/functions/gear-boost-activate/index.ts` | JWT-resolves caller, **verifies the store receipt before activating** (RevenueCat REST; fail-closed in prod), calls `activate_gear_boost`, idempotent on replay. |
| Feature flag | `.env.example` → `EXPO_PUBLIC_GEAR_BOOST_ENABLED` | Off by default; nothing leaks into the current OTA build. |

## Build 14 steps (to make it live)

1. **Apply the DB migration to hosted.** `supabase db push` (or apply 074 via the dashboard). Until then the boost RPC fields simply don't return and the UI shows no badge.
2. **Deploy the Edge Function.** `supabase functions deploy gear-boost-activate`.
3. **Create the IAP product** in App Store Connect → your app → In-App Purchases → **Consumable**, product id **`gear_boost_7d`**, price ~$2.99 (Tier 3). Add a localized display name + review screenshot. (Enroll in the **Small Business Program** if not already — 15% instead of 30% under $1M/yr; The Village qualifies.)
4. **RevenueCat** (handles receipt validation for the consumable now + the Pro subscription later):
   - Create a RevenueCat project, add the iOS app + App Store shared secret.
   - Add `gear_boost_7d` as a product; put it in the `current` offering.
   - Copy the **public SDK key** (client) and the **secret key** (server).
5. **Install the SDK** (native — triggers the Build 14 prebuild):
   - `pnpm --filter mobile add react-native-purchases`
   - Initialize in `App.tsx`: `Purchases.configure({ apiKey: <public key> })`, and call `Purchases.logIn(supabaseUserId)` on sign-in so RC's `app_user_id` == our user id (the Edge Function verifies by that id).
6. **Wire `purchaseGearBoost`** in `src/lib/boost.ts` — replace the stub body with the documented RevenueCat flow (dynamic `import('react-native-purchases')` *inside* the function; on `userCancelled` throw `BoostCancelledError`; pass `transaction.transactionIdentifier` to `activateGearBoost`).
7. **Set Edge Function secrets** (Supabase → Settings → Secrets): `REVENUECAT_SECRET_KEY`. Leave `BOOST_ALLOW_UNVERIFIED` unset in prod (it's a dev/sandbox-only escape hatch).
8. **Flip the flag** in the Build 14 EAS env: `EXPO_PUBLIC_GEAR_BOOST_ENABLED=1`.
9. **Build + submit** Build 14 via EAS; test the purchase with a **sandbox** Apple account first (TestFlight uses the sandbox StoreKit env).

## Security model (why a client can't fake a boost)

1. The Edge Function resolves the user from the **JWT**, never the body.
2. It **verifies the receipt** with RevenueCat (non-subscription purchase of `gear_boost_7d` whose `store_transaction_id` matches) before activating. No verification → reject (fail-closed), except when `BOOST_ALLOW_UNVERIFIED=1` (dev/sandbox).
3. Activation runs through the **service-role-only** `activate_gear_boost` RPC; the `gear_boosts` ledger has **no client-write policy**, and a **UNIQUE(platform_transaction_id)** index makes a replayed transaction a no-op (idempotent success).

## Pricing & future

- MVP: `gear_boost_7d` ≈ **$2.99 / 7 days**, stackable (buying again extends the window).
- **Pro perk (V5 5.3):** grant Pro subscribers N free boosts/month. The path is reserved (`source='pro_perk'`), and `gear-boost-activate` currently rejects it (`pro_perk_not_available`) until the Pro entitlement check + monthly-allowance accounting are built.
- Android: the schema/flow are platform-tagged (`platform='android'`) but Google Play Billing wiring is out of scope until an Android build exists.

## Follow-ups

- i18n: `BoostListingScreen.tsx` copy is English-first. Localize (en+es) before flipping the flag. (`MyListings` / detail / browse boost strings are already keyed in en.json + es.json.)
- Analytics: `gear-boost-activate` writes a `gear_boost_activated` row to `gear_analytics_events` for revenue tracking.
