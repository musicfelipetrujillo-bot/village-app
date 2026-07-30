# villie pro — Manual video paywall + RevenueCat IAP (Build 14)

**Date:** 2026-07-29 · **Approved by:** Felipe (chat, this date) · **Status:** approved, implementing

## Decisions (Felipe, 2026-07-29)

| Question | Decision |
|---|---|
| Pro pricing | **$6.99/mo + $49.99/yr** (`villie_pro_monthly`, `villie_pro_annual`) |
| Trial | **7-day free trial** on both plans (App Store intro offer) |
| Free tier boundary | **All Manual videos premium** (week-intro + how-to/deep-dive). 52-week written/text content stays free, forever. |
| Gear Boost | **Ships in the same Build 14** (`gear_boost_7d` consumable, flag flipped) |

The V5 doc scoped Pro as Playbook + mom hacks; this build anchors Pro on **Manual videos** instead. Playbook joins the same `pro` entitlement when 5.3 content ships — paywall copy promises only videos (nothing unshipped).

## Server (migration 110 + edge function)

- `users.is_pro BOOLEAN NOT NULL DEFAULT false`.
- `pro_subscription_events` ledger — raw RevenueCat webhook events, service-role write only, `UNIQUE(event_id)` for idempotent replay.
- `current_user_is_pro()` SECURITY DEFINER helper (authenticated + service_role only).
- **Feature flag `pro_video_gate`** (feature_flags row, seeded OFF): gating in the RPCs only activates when the flag is on. This lets migration 110 apply to hosted **today** without locking videos for the current OTA audience that has no paywall. Flip when Build 14 + paywall are live.
- `list_manual_videos`: same shape + `is_locked BOOLEAN`. When `pro_video_gate` is on and caller is not pro: `mux_playback_id`/`html_url` return NULL, `is_locked = true`. Metadata (title, thumbnail, duration, captions) always returned → teaser cards.
- New `get_manual_week_intro(p_audience, p_week, p_locale)` RPC with the same null-out + `is_locked` behavior; the `manual_week_intro_public_read` SELECT policy is rewritten to return zero rows to locked callers (old OTA bundles keep working while the flag is off; post-flip, playback ids can't leak via PostgREST and old free-tier bundles just hide the slot via the existing fail-soft path).
- `revenuecat-webhook` edge function (verify_jwt off, custom auth): requires `Authorization: Bearer ${REVENUECAT_WEBHOOK_AUTH}`; inserts ledger row (skip on duplicate event id); sets `is_pro = true` on INITIAL_PURCHASE / RENEWAL / UNCANCELLATION / PRODUCT_CHANGE with `pro` in `entitlement_ids`, `false` on EXPIRATION. CANCELLATION (auto-renew off, still entitled) and BILLING_ISSUE (grace) don't change state. Ignores `$RCAnonymousID:` app_user_ids.

## Client

- `store/user.ts`: `is_pro` added to `UserProfile` + SELECT.
- `lib/pro.ts`: `PRO` config (product ids, price labels, trial days), `isProEnabled()` = `EXPO_PUBLIC_PRO_ENABLED === '1'` build flag, `isProUser()` = dev override || last-known RevenueCat entitlement || `profile.is_pro`. `purchasePro(plan)` / `restorePro()` with **dynamic import of react-native-purchases inside the function** (boost.ts pattern — no native import at module scope, OTA-safe). After purchase, CustomerInfo unlocks UI immediately; profile refetch (short retry) picks up the webhook-written `is_pro` so gated RPCs return playback ids.
- `api/manual.ts`: `is_locked` on `ManualVideo` + `WeekIntroVideo`; `getWeekIntroVideo` switches from table select to the RPC.
- `PaywallScreen` (modal in RootNavigator): per approved mock — Caveat flourish, Bricolage headline, benefits, annual (save-40% honey badge) + monthly cards, deep-berry pill CTA "start your free week", sober fine print (auto-renew, cancel anytime, restore, terms/privacy). EN + ES. No medical-efficacy claims (Guideline 3.1.1 flag in V5 doc).
- Locked states: week-intro card in `ManualScrollV3`, `DeepDiveVideoCard`, `ManualCategoryScreen` grid — thumbnail + rose `pro` pill + lock, tap → Paywall. `ManualVideoScreen`/ClipPlayer entry guards on `is_locked` → Paywall. **Never a broken player.**
- `App.tsx`: guarded `Purchases.configure` + `Purchases.logIn(supabaseUserId)` (RC app_user_id == our user id — the webhook and gear-boost-activate both key on it).

## Build 14

`react-native-purchases` dep → `expo prebuild --clean --platform ios` → `pnpm ios:patch` (path-with-spaces patches; Stripe already ^0.66.0; Sentry patch is committed via pnpm patch) → `.xcode.env.local` SENTRY_DISABLE_AUTO_UPLOAD for local, EAS env for prod → EAS build/submit. ASC: two auto-renewable subs (one group, 7-day intro trial) + `gear_boost_7d` consumable; RevenueCat project w/ `pro` entitlement + `current` offering; secrets `REVENUECAT_SECRET_KEY`, `REVENUECAT_WEBHOOK_AUTH`; EAS env flags `EXPO_PUBLIC_PRO_ENABLED=1`, `EXPO_PUBLIC_GEAR_BOOST_ENABLED=1`. Full checklist: `docs/BUILD_14_PRO_IAP_RUNBOOK.md`.

## Rollout order (safety)

1. Migration 110 + webhook fn deploy now (gate flag OFF → zero user-visible change).
2. Client code ships in Build 14 only (flags unset in OTA env).
3. After Build 14 approved + live: flip `pro_video_gate` DB flag. Old OTA users keep playing videos until they update (flag-on affects them too — accepted: locked cards render as "no video" fail-soft states in old bundles, verified fail-soft paths exist in api/manual.ts).

## Error handling

- Webhook: bad auth → 401; malformed → 400 logged; duplicate event → 200 no-op; unknown user id → 200 logged (don't retry-loop RevenueCat).
- Purchase: userCancelled → silent; other store errors → alert with retry; activation lag → UI unlocked from CustomerInfo, RPC content unlocks on webhook (retry refetch ~3×2s, then banner "syncing your pro access…" fail-soft).
- RPCs on old clients (no is_locked field): extra column is ignored by existing decoders — shape is additive.
