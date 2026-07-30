# Build 14 — villie pro subscription + Gear Boost (RevenueCat IAP)

Native build. Ships **two** revenue lines on one RevenueCat setup:
- **villie pro** — auto-renewable subscription gating Manual videos (this doc)
- **Gear Boost** — `gear_boost_7d` consumable (`docs/V4_GEAR_BOOST_RUNBOOK.md`)

Design + decisions: `docs/superpowers/specs/2026-07-29-villie-pro-video-paywall-design.md`.

## Decisions (Felipe, 2026-07-29)

| | |
|---|---|
| Price | $6.99/mo · $49.99/yr |
| Trial | 7 days, both plans |
| Free tier | 52-week **written** manual stays free forever. **All videos** are Pro. |
| Gear Boost | ships in this same build |

## Already done (2026-07-29/30)

- ✅ Migration **110** applied to hosted — `users.is_pro`, `pro_subscription_events`, `current_user_is_pro()`, `manual_videos_locked_for_caller()`, gated `list_manual_videos`, new `get_manual_week_intro`, `pro_video_gate` flag **seeded OFF**.
- ✅ `revenuecat-webhook` edge function deployed (`--no-verify-jwt`).
- ✅ Client: `lib/pro.ts`, `PaywallScreen` + root modal route, locked teaser cards (week-intro, category list, deep-dive, ClipPlayer backstop), EN+ES copy, `react-native-purchases` dep, `configureProPurchases` in `App.tsx`. `tsc` clean.

Nothing is user-visible yet: the DB flag is off and `EXPO_PUBLIC_PRO_ENABLED` is unset.

## Steps to go live

### 1. App Store Connect
- Enroll in the **Small Business Program** if not already (15% vs 30%).
- Subscriptions → new group **"villie pro"**, two auto-renewables:
  - `villie_pro_monthly` — $6.99/month
  - `villie_pro_annual` — $49.99/year
  - On **each**: Introductory Offer → **Free trial, 7 days**, all territories.
- In-App Purchases → Consumable `gear_boost_7d` — $2.99.
- Every product needs localized display name/description + a review screenshot, or review rejects the build.
- Agreements, Tax, and Banking must be **Active** before products leave "Missing Metadata".

### 2. RevenueCat
- Project → iOS app: bundle `com.villieapp.mobile`, App Store **shared secret**, App Store Connect API key (for server notifications).
- Products: add all three ids.
- **Entitlement `pro`** ← attach `villie_pro_monthly` + `villie_pro_annual`. (Do NOT attach `gear_boost_7d` — boost is verified per-transaction by `gear-boost-activate`.)
- Offering `current` → package `$rc_monthly` (monthly) + `$rc_annual` (annual). `lib/pro.ts` matches by **product identifier**, so package naming is free-form, but the products must be in `current`.
- Integrations → Webhooks:
  - URL `https://albyndcruwopulazvpjs.supabase.co/functions/v1/revenuecat-webhook`
  - Authorization header value: a fresh random 32+ char token.
- Copy the **public SDK key** and the **secret key**.

### 3. Secrets + env
| Where | Key | Value |
|---|---|---|
| Supabase secrets | `REVENUECAT_WEBHOOK_AUTH` | same token as the RC webhook header |
| Supabase secrets | `REVENUECAT_SECRET_KEY` | RC secret key (Gear Boost receipt verification) |
| EAS build env | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | RC **public** SDK key |
| EAS build env | `EXPO_PUBLIC_PRO_ENABLED` | `1` |
| EAS build env | `EXPO_PUBLIC_GEAR_BOOST_ENABLED` | `1` |
| EAS build env | `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | for source-map upload |

Dev-only: `EXPO_PUBLIC_PRO_SIMULATE=1` forces `isProUser()` true in `__DEV__` so gated UI can be exercised without a purchase.

### 4. Native build (iOS 26 fixes — memory `project_ios26_build_fixes.md`)

```bash
cd apps/mobile
npx expo prebuild --clean --platform ios
pnpm ios:patch              # idempotent; re-applies the path-with-spaces patches
pnpm ios:patch:verify       # confirm before building
echo "export SENTRY_DISABLE_AUTO_UPLOAD=true" >> ios/.xcode.env.local   # LOCAL builds only
```
Already handled and needing no action: Stripe is at `^0.66.0`; the Sentry `sentry-xcode.sh` fix is a committed pnpm patch that survives reinstalls.

Then `eas build --profile production --platform ios` and `eas submit`.

### 5. Sandbox test (TestFlight uses the sandbox StoreKit env)
1. Sign in with a **Sandbox Apple ID** (Settings → App Store → Sandbox Account).
2. Paywall → yearly → purchase. Expect: success alert, videos unlock immediately.
3. Verify the server saw it:
   ```sql
   SELECT event_type, entitlement_ids, environment, created_at
     FROM pro_subscription_events ORDER BY created_at DESC LIMIT 5;
   SELECT is_pro FROM users WHERE id = '<uuid>';
   ```
4. Delete + reinstall → **Restore purchases** → entitlement returns.
5. Buy a Gear Boost; confirm the listing floats and `gear_boosts` gets a row.

### 6. Flip the gate (last step, only after the build is live)
```sql
UPDATE feature_flags SET enabled = TRUE, updated_at = now() WHERE key = 'pro_video_gate';
```
Until this runs, **every** user (including free) keeps full video access — that's deliberate, so nobody loses content before they can buy it.

Rollback is the same statement with `FALSE`. Instant, no deploy.

## Post-flip behavior

| Client | Free user | Pro user |
|---|---|---|
| Build 14+ | teaser cards + lock + paywall | full playback |
| Older OTA bundle | week-intro slot hides; category rows show cards that no-op | full playback |

Old bundles degrade quietly rather than showing a broken player, because both read paths fail soft (`api/manual.ts`).

## Open items before flipping

- [ ] Privacy Policy: disclose the RevenueCat processor + subscription data (`https://villieapp.com/privacy` is linked from the paywall).
- [ ] Terms of Use: paywall currently links Apple's standard EULA — swap for the villie ToS when counsel publishes it (update here **and** in App Store Connect metadata).
- [ ] Gear Boost i18n: `BoostListingScreen.tsx` copy is English-only (flagged in the Gear Boost runbook).
- [ ] Decide whether Playbook / mom hacks join the `pro` entitlement when V5 5.3 content ships (paywall copy promises videos only today).
