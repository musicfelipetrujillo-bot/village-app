# Villie Operations Runbook

> **Single source of truth** for every dashboard config, env var, secret,
> smoke-test recipe, and rotation calendar item the app needs to run.
>
> When you find yourself digging through Slack/memory/chat for "wait,
> where do I drop that key again?" — that's this doc's failure to capture
> it. **Fix it here.**

Companion docs (don't duplicate, just link):
- `docs/STATUS.md` — current per-vertical build status
- `docs/PRE_LAUNCH_RUNBOOK.md` — one-time pre-launch infra setup checklist
- `docs/AUTH_PROVIDER_SETUP.md` — narrow OAuth dashboard walkthrough
- `docs/V4_GEAR_TAKEDOWN_SOP.md` — gear moderation SLA
- `CLAUDE.md` — authoritative per-phase build log

---

## 1 · Account inventory

| Account | Used for | Owner | Notes |
|---|---|---|---|
| **Supabase project** `albyndcruwopulazvpjs` | DB + RLS + Auth + Storage + Edge Functions | gmail | Free tier; pg_cron HTTP callouts no-op → replaced by GH Action cron in `.github/workflows/supabase-crons.yml` |
| **Apple Developer Team** `B9BRJPBM6G` | iOS bundle, Sign In with Apple, Universal Links | Felipe | Bundle: `com.villieapp.mobile` (NOT the older `com.thevillage.app` which is squatted) |
| **Google Cloud project** `the-village-app-494701` | Google Sign-In + Google Maps + Places | gmail | OAuth clients: `Villie Web (for Supabase)` + `Villie iOS` |
| **Resend** account — **gmail** | Transactional + newsletter | gmail | Owns `villieapp.com` apex. **Use this one.** |
| **Resend** account — hotmail | Legacy | hotmail | Owns `send.villieapp.com`. Don't use for newsletter — apex sender is on the other account. |
| **GitHub repos** | `village-app`, `village-website` | musicfelipetrujillo-bot | website hosted on GitHub Pages from `village-website/main` |
| **OneSignal** | Push notifications | Felipe | Separate iOS + Android apps |
| **Stripe** | V1 Specialist booking only (Milk + Gear are cash-only since 2026-05-21) | Felipe | Connect platform agreement signed |
| **Twilio** | SMS reminders + crisis pager | Felipe | A2P 10DLC pending (see memory `project_twilio_a2p_blocker.md`) — toll-free verification is the fast path |
| **Anthropic** | All AI fns (Haiku real-time, Sonnet batch) | Felipe | Usage cap recommended |

---

## 2 · Required secrets per environment

### 2.1 · `apps/mobile/.env` (machine-local, gitignored)

| Variable | Required? | Where to get it | Notes |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ yes | Supabase Dashboard → Project Settings → API → URL | safe to share (public) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ yes | same → `anon` key | safe (RLS gates) |
| `EXPO_PUBLIC_API_BASE_URL` | ✅ yes | derived: `<SUPABASE_URL>/functions/v1` | safe |
| `EXPO_PUBLIC_APP_ENV` | ✅ yes | `"development"` locally, `"production"` for EAS prod builds | safe |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | required for any in-app payment | Stripe Dashboard → Developers → API keys → Publishable key (`pk_…`) | safe (public). Used by Specialist booking PaymentScreen **and** Villie Boxes checkout. test `pk_test_…` for staging, live `pk_live_…` for prod |
| `EXPO_PUBLIC_OAUTH_PROVIDERS_ENABLED` | optional | `"1"` to show Apple + Google buttons on Login/SignUp | feature flag |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | required if OAUTH=1 | Google Cloud → OAuth Clients → `Villie Web (for Supabase)` | safe (public) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | required if OAUTH=1 | Google Cloud → OAuth Clients → `Villie iOS` | safe (public) |
| `EXPO_PUBLIC_INTERNAL_AGENTS_ENABLED` | optional | `"1"` to show internal AGT badge | dev-only feature flag |
| `EXPO_PUBLIC_MILK_STRIPE_ENABLED` | optional | OFF by default (cash-only MVP). Set `"1"` to re-enable the legacy Stripe Milk purchase flow | requires money-transmitter counsel sign-off before flip — see memory `project_milk_cash_only.md` |
| `EXPO_PUBLIC_DELETE_ACCOUNT_ENABLED` | optional | OFF by default. Set `"1"` to show the Delete Account row in Me. Cascade scrub is attorney-gated. | see CLAUDE.md A2.c |
| `SUPABASE_SERVICE_ROLE_KEY` | required for `pnpm specialist:invite` | Supabase Dashboard → Project Settings → API → `service_role` key | ⚠️ **PASSWORD-tier**, never commit |

### 2.2 · Supabase Edge Function Secrets (Dashboard → Edge Functions → Manage Secrets)

| Variable | Used by | Required? | Where to get it | Notes |
|---|---|---|---|---|
| `RESEND_API_KEY` | newsletter, gear-moderation digest | yes | Resend → API Keys → Full access | one key shared across functions |
| `RESEND_WEBHOOK_SECRET` | resend-webhook (open/click tracking) | yes | Resend → Webhooks → Signing Secret (`whsec_…`) | per-endpoint secret; rotate if leaked |
| `VILLIE_NEWSLETTER_FROM` | villie-weekly-digest | optional | override the default `hello@villieapp.com` | must be a verified sender |
| `GEAR_MODERATOR_DIGEST_EMAILS` | gear-moderation-daily-digest | yes | comma-separated emails | currently `moderator@villieapp.com` |
| `GEAR_MODERATOR_DIGEST_FROM` | same | optional | default `Villie Moderation <noreply@villieapp.com>` | — |
| `GEAR_MODERATOR_EXTERNAL_IDS` | gear-moderation-pager | yes | OneSignal external_ids (UUIDs) | currently just Felipe |
| `ANTHROPIC_API_KEY` | every AI fn | yes | Anthropic console | one key shared |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER` | twilio-sms (called by appointment-reminder, room-message-scan crisis fan-out, milk-purchase-confirmed) | yes (when SMS goes live) | Twilio console | A2P 10DLC pending |
| `ONESIGNAL_APP_ID` + `ONESIGNAL_REST_API_KEY` | push-notify | yes | OneSignal → Settings → Keys | one pair per app |
| `STRIPE_SECRET_KEY` | create-payment-intent (V1 booking) **+ boxes-create-payment-intent (Villie Boxes)** | yes | Stripe Dashboard → Developers → API keys | test keys for staging, live for prod. One key shared by both payment fns |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook (Villie Boxes order lifecycle) | yes (before Boxes go-live) | Stripe → Developers → Webhooks → your endpoint → Signing secret (`whsec_…`) | per-endpoint. Code reads exactly this name (`Deno.env.get('STRIPE_WEBHOOK_SECRET')`). Until set, the webhook rejects every event 400 and orders stay `pending_payment`. See §3.8 |
| `CALENDLY_SIGNING_KEY` | calendly-webhook | yes | Calendly → Integrations → Webhooks | — |
| `GO_UPC_API_KEY` / `UPCITEMDB_API_KEY` | gear-upc-lookup | optional | Go-UPC or UPCitemdb | degrades to manual entry without |
| `EBAY_APP_ID` + `EBAY_CERT_ID` | gear-price-suggest | optional | eBay Developer Program → Production Keyset | absent → function returns heuristic-only `source: 'heuristic'`. Adding both auto-promotes to live eBay Browse-API comps without any client change. Waiting on Developer account approval (~1 day) as of 2026-05-15. |
| `ADMIN_USER_IDS` | admin-specialist-invite | yes (for in-app admin invite UI) | comma-separated user UUIDs allowed to issue specialist invites from the mobile Me → Admin tab. Felipe: `8c6b38eb-f5dd-4231-8426-83c7d31453fb`. Empty / missing → all callers rejected (mobile screen surfaces friendly 403). |
| `PERKS_WEBHOOK_SECRET` / `IMPACT_WEBHOOK_SECRET` / `SHAREASALE_API_SECRET` / `CJ_ALLOWED_IPS` | perks-redemption-webhook | optional | per affiliate network | not active until G3 affiliate contracts |

### 2.3 · GitHub Actions secrets

| Variable | Used by | Required? | Notes |
|---|---|---|---|
| `SUPABASE_PROJECT_REF` | `.github/workflows/supabase-crons.yml` | yes | currently `albyndcruwopulazvpjs` |
| `SUPABASE_SERVICE_ROLE_KEY` | same | yes | same value as in apps/mobile/.env. Replaces broken pg_cron HTTP callouts on Free tier |

### 2.4 · EAS Build env (eas.json)

| Variable | Profile | Required? | Notes |
|---|---|---|---|
| `EXPO_PUBLIC_GIT_SHA` | all | optional | injected by build script; surfaces in Sentry release tag |
| `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` | prod | required for source-map upload | dev sets `SENTRY_DISABLE_AUTO_UPLOAD=true` in `.xcode.env.local` instead |

---

## 3 · Per-feature smoke tests

Run after any change that touches the feature. Each one ends in a **green check** the user actually sees.

### 3.1 · Specialist invite (V1 Option C)

**Prereq:** `SUPABASE_SERVICE_ROLE_KEY` in `apps/mobile/.env`.

```bash
cd apps/mobile
pnpm specialist:invite
# answer prompts with: your own email, "Dr Test Felipe", MD, ob_gyn, skip NPI, "smoke test"
```

**Expected:**
- Script returns `✓ Invite created` with `Email sent: true`
- Email arrives in inbox/spam within 30 sec from `Villie <noreply@villieapp.com>` (or whatever `GEAR_MODERATOR_DIGEST_FROM` resolves to)
- Click the URL → `villieapp.com/onboard/<token>` loads with your name + specialty pre-filled

**If 403 Forbidden:** auth-pattern regression. Verify the function uses the `isServiceRoleRequest()` JWT-decode helper (commit `292ea14`), not strict equality.

**If `Email sent: false`:** Resend `RESEND_API_KEY` is missing or the from-address isn't verified. Check Resend dashboard → Domains.

---

### 3.2 · Sunday newsletter (test-fire before Sunday)

**Prereq:** at least one user has `notif_prefs.newsletter=true` OR use `test_recipient` mode (preferred).

```bash
# Via curl with service-role:
curl -X POST 'https://albyndcruwopulazvpjs.supabase.co/functions/v1/villie-weekly-digest' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"test_only": true, "test_recipient": "your@email.com"}'
```

**Expected:**
- 200 response with `{ ok: true, sent: 1, failed: 0 }`
- Email arrives in inbox within 1 min from `hello@villieapp.com` (or `VILLIE_NEWSLETTER_FROM` override)
- Email renders: brand-aligned cream background, Playfair title, top video card with real thumbnail, crisis-resources footer
- `test_only: true` means `newsletter_sends` row is NOT inserted — your Sunday opt-in still works

**Audit query** after Sunday's first real auto-fire:
```sql
SELECT
  period_start,
  COUNT(*) AS total_sent,
  COUNT(opened_at) AS opened,
  COUNT(first_click_at) AS clicked,
  ROUND(100.0 * COUNT(opened_at)::numeric / COUNT(*), 1) AS open_rate_pct
FROM newsletter_sends
GROUP BY period_start
ORDER BY period_start DESC;
```

---

### 3.3 · Resend webhook (engagement tracking)

**Status (2026-05-24):** Wired end-to-end. Endpoint `https://albyndcruwopulazvpjs.supabase.co/functions/v1/resend-webhook` is enabled in the Resend dashboard, subscribed to all 11 email events, signing secret loaded in Supabase Edge Function Secrets.

**Prereq:** `RESEND_WEBHOOK_SECRET` in Supabase Edge Function Secrets.

**Quick verification** (no dashboard needed — anyone can run):
```bash
curl -sS -o /tmp/probe.json -w "HTTP=%{http_code}\n" -X POST \
  "https://albyndcruwopulazvpjs.supabase.co/functions/v1/resend-webhook" \
  -H "Content-Type: application/json" \
  -d '{"type":"email.opened","data":{}}'
# Expect: HTTP=401, body {"error":"invalid signature"}
# A 401 here proves the secret is loaded — real Resend events come signed.
```

**Real-traffic verification:** Open one of the test newsletters, then:
```sql
SELECT period_start, opened_at, first_click_at, click_count
FROM newsletter_sends
WHERE recipient_email = 'musicfelipetrujillo@gmail.com'
ORDER BY created_at DESC LIMIT 5;
```

In the Resend dashboard:
1. Webhooks → endpoint → **Send test event**
2. Expect **200 OK** in the response panel

**If 401 Forbidden** from a *real* Resend event (vs. our intentional probe above): `RESEND_WEBHOOK_SECRET` env var isn't set OR doesn't match the dashboard signing secret. Rotate via Resend → Webhooks → Rotate signing secret, then re-set in Supabase.

---

### 3.4 · Manual saves + share

On the iOS sim (or any real build):
1. **Manual tab** → pick a video → tap heart ♡ → flips to ♥ (filled cinnamon)
2. **Manual tab → Saved** pill (top-right of header) → video appears
3. **Me → Saved** → "From the manual" section → same video appears
4. Tap the video → tap **Share** → iOS share sheet → cancel
5. Tap **Share** → pick any app → send → check Twitter/Slack/iMessage for the preview card

**Expected:**
- Preview card shows **the actual video thumbnail + title** (not the generic villie wordmark)
- This works via the `manual-og` edge function detecting crawler User-Agents

**Audit:**
```sql
SELECT video_id, channel, COUNT(*) AS shares FROM manual_video_shares
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10;
```

---

### 3.5 · OAuth (Apple + Google Sign-In)

**Prereq:** `EXPO_PUBLIC_OAUTH_PROVIDERS_ENABLED=1` in `.env` + iOS native rebuild (see §4).

**Canonical validation surface = TestFlight on a real iPhone.** The sim can do the *button tap* but not the *full flow*: Google has no real Google app to deep-link into, Face ID is simulated, callback URL handling differs from device. A passing sim run doesn't prove TestFlight works; a failing sim run doesn't prove TestFlight is broken. Use the sim only to confirm the button is present and doesn't crash; treat the actual auth confirmation as a TestFlight gate.

On the sim (smoke-only):
1. Login screen → "Sign in with Apple" — tap → Apple sheet appears (Face ID simulated)
2. SignUp screen → "Continue with Google" — tap → Google sheet appears in Safari

On TestFlight / real iPhone (canonical):
1. Same taps, but with a real Apple ID + Google account → confirm full round-trip → app comes back authed
2. Verify with:

```sql
SELECT email, raw_app_meta_data->>'provider' AS provider, created_at
FROM auth.users
WHERE raw_app_meta_data->>'provider' IN ('apple','google')
ORDER BY created_at DESC LIMIT 5;
```

**Expected:** `auth.users.provider` shows `apple` and `google` for the new rows.

```sql
SELECT email, provider, created_at FROM auth.users
WHERE provider IN ('apple', 'google')
ORDER BY created_at DESC LIMIT 10;
```

---

### 3.6 · Universal Links

**Prereq:** AASA file live at `https://villieapp.com/.well-known/apple-app-site-association` + iOS app installed.

```bash
# 1. Verify AASA is reachable
curl -I https://villieapp.com/.well-known/apple-app-site-association
# Expect: HTTP/2 200

curl https://villieapp.com/.well-known/apple-app-site-association | jq .
# Expect: valid JSON, appIDs contains "B9BRJPBM6G.com.villieapp.mobile"
```

On phone:
1. Open Messages.app, text yourself `https://villieapp.com/m/?v=<known-video-id>`
2. Tap the link in Messages

**Expected:** Opens villie → ManualVideoScreen, NOT Safari.

**If it opens Safari:** Apple Associated Domains capability is missing on the App ID, OR Apple's CDN hasn't refreshed the AASA cache yet (can take up to 24h after install). Force-reinstall the app to retrigger fetch.

---

### 3.7 · Gear moderation daily digest

```bash
# Manually trigger
curl -X POST 'https://albyndcruwopulazvpjs.supabase.co/functions/v1/gear-moderation-daily-digest' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Expected:** 200 response, email lands in `moderator@villieapp.com` (or whatever `GEAR_MODERATOR_DIGEST_EMAILS` is set to), even on quiet days.

---

### 3.8 · Villie Boxes (curated-commerce checkout — real Stripe)

First-party physical-goods retail sold BY Villie (not P2P). Flow: Home card → Boxes hub → box detail/customize → cart → checkout (Stripe PaymentSheet) → confirmation → **webhook flips order to `paid`** → order history (hub "My orders" + Me → My stuff). Catalog is hardcoded in `apps/mobile/src/api/boxes.ts` **and mirrored** in the edge fn `CATALOG` const — keep them in sync until it moves to a `villie_boxes` table.

**One-time go-live setup (do all four — Boxes is otherwise dark):**

```bash
# 1. Push the order tables (villie_box_orders + villie_box_order_items, owner-read RLS)
supabase db push        # applies migration 092_villie_boxes_orders.sql

# 2. Deploy both edge functions
supabase functions deploy boxes-create-payment-intent stripe-webhook
```

3. **Secrets** (Supabase → Edge Functions → Manage Secrets): `STRIPE_SECRET_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (both already set for V1 booking) cover `boxes-create-payment-intent`. The webhook additionally needs `STRIPE_WEBHOOK_SECRET` — set in step 4.
4. **Register the Stripe webhook endpoint** (this is the step that's easy to forget):
   - Stripe Dashboard → Developers → Webhooks → **Add endpoint**
   - URL: `https://albyndcruwopulazvpjs.supabase.co/functions/v1/stripe-webhook`
   - Events to send: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
   - Copy the endpoint's **Signing secret** (`whsec_…`) → Supabase Edge Function Secrets as `STRIPE_WEBHOOK_SECRET`
   - Client needs `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `apps/mobile/.env` (already set for booking — same key)

**Smoke test the webhook is wired (before trusting a real order):**

```bash
# Unsigned POST should be REJECTED — proves signature verification is live.
curl -i -X POST \
  "https://albyndcruwopulazvpjs.supabase.co/functions/v1/stripe-webhook" \
  -H 'Content-Type: application/json' \
  -d '{"type":"payment_intent.succeeded","data":{"object":{}}}'
# Expect: HTTP/2 400, body "Missing signature or secret" (no secret header) —
# a 400 here is GOOD; it means the fn is deployed and rejecting unsigned events.
# Real Stripe events arrive signed and return {"received":true}.
```

**End-to-end (test mode):** with `pk_test_…`/`sk_test_…`, run a checkout in the app using Stripe test card `4242 4242 4242 4242`. Then in the Stripe Dashboard → Webhooks → your endpoint, confirm the `payment_intent.succeeded` delivery shows `200`. In Supabase Studio, the matching `villie_box_orders` row should flip `pending_payment → paid` with `paid_at` set. The app's "My orders" screen (hub header or Me → My stuff → "Villie Boxes orders") should show the **Paid** pill.

**Still-open pre-launch gates (not ops — flagged in memory `project_villie_boxes.md`):** FL sales-tax obligation on physical goods (shipping/tax are $0 at launch, baked into box pricing); Risk & Compliance review pass (first first-party physical-goods sale, not in the Risk doc); real retail prices + product photos (current tiles are gradient swatches, prices are placeholders).

---

## 4 · Native iOS build cycle

Three steps. The middle one is the recurring landmine.

```bash
cd apps/mobile

# Clean regen of ios/ folder from app.json + plugins
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo prebuild --clean --platform ios

# Re-apply the three path-with-spaces patches that die on every clean prebuild
pnpm ios:patch

# Build — xcodebuild path is the most reliable.
#
# Why not `pnpm run ios` / `expo run:ios`?
#   On this machine the Xcode CLI devicectl reports an unexpected JSON
#   version. expo-cli reads that, decides the booted iPhone 17 sim is a
#   *physical* device, and bails on "No code signing certificates" before
#   ever invoking the compiler. Symptom in /tmp/villie-ios-build.log:
#     "Unexpected devicectl JSON version output from devicectl"
#     "CommandError: No code signing certificates are available to use."
#   The xcodebuild path below targets the simulator destination explicitly
#   and disables code signing, so devicectl is never consulted.
cd ios
xcodebuild -workspace villie.xcworkspace -scheme villie -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=latest' \
  -derivedDataPath build \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO \
  build 2>&1 | tail -20

# Install + launch on the booted sim
APP=$(find build/Build/Products/Debug-iphonesimulator -maxdepth 1 -name "*.app" -type d | head -1)
xcrun simctl install booted "$APP"
xcrun simctl launch booted com.villieapp.mobile
```

**If you hit `bash: /Users/gp/The: No such file or directory`:** the path-with-spaces patches aren't applied. Run `pnpm ios:patch` first.

**Sentry-related verify:** `pnpm ios:patch:verify` confirms all five anchors are patched without applying.

**Why path-with-spaces patches exist:** the project lives at `/Users/gp/The Village App/` — Apple build tools choke on the spaces. Permanent fix would be moving the project to `/Users/gp/villie-app/`. Documented in `memory/project_ios26_build_fixes.md`.

---

## 5 · Rotation calendar

Set calendar reminders for these.

| What | Cadence | Next due | How |
|---|---|---|---|
| Apple Sign In with Apple client_secret JWT | every 180 days | **~2026-11-16** | Python snippet in `memory/project_oauth_setup.md` — generates JWT from the `.p8` at `/Users/gp/The Village App/villie-apple-signin-key.p8`. Paste new JWT into Supabase → Auth → Providers → Apple → Secret Key |
| Resend webhook signing secret | yearly or if leaked | — | Resend → Webhooks → Rotate. Update `RESEND_WEBHOOK_SECRET` in Supabase Edge Secrets |
| Resend API key | only if leaked | — | Resend → API Keys → Rotate. Update `RESEND_API_KEY` in Supabase Edge Secrets |
| Supabase service role key | only if leaked (paranoid) | — | Supabase → API → Rotate. Update apps/mobile/.env AND GitHub Actions secret |
| Google OAuth client secret | only if leaked | — | Google Cloud → Credentials → Villie Web → Rotate. Update Supabase → Auth → Providers → Google → Secret |

---

## 6 · Common "where do I drop X?" lookups

Quick table for the most-googled questions.

| Need to set… | Where it lives | Affects what |
|---|---|---|
| `RESEND_WEBHOOK_SECRET` | Supabase dashboard → Edge Functions → Manage Secrets | newsletter open/click tracking |
| `SUPABASE_SERVICE_ROLE_KEY` | apps/mobile/.env (local) + GitHub Actions secrets (cron) | `pnpm specialist:invite`, GH Action crons |
| Apple JWT for Sign In | Supabase Dashboard → Auth → Providers → Apple → Secret Key (paste full JWT) | Apple Sign In on web only (iOS-native unaffected) |
| Google OAuth Secret | Supabase Dashboard → Auth → Providers → Google → Client Secret | Google Sign In on web only (iOS-native unaffected) |
| `VILLIE_NEWSLETTER_FROM` | Supabase Edge Function Secrets | overrides default sender for Sunday newsletter |
| `OAUTH_PROVIDERS_ENABLED=1` | apps/mobile/.env | enables Apple + Google buttons on Login/SignUp |
| OneSignal external_id for new moderator | `GEAR_MODERATOR_EXTERNAL_IDS` env on Supabase Edge Function Secrets (comma-separated) | gear moderation pager fan-out |
| New AASA appID | `village-website/.well-known/apple-app-site-association` + redeploy via git push to `main` | Universal Links — what URL paths the iOS app claims |
| `STRIPE_WEBHOOK_SECRET` | Supabase Edge Function Secrets (after registering the endpoint in Stripe → Webhooks) | Villie Boxes order status (`pending_payment → paid`). Missing → orders never mark paid. See §3.8 |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | apps/mobile/.env (local) + EAS env (builds) | Stripe PaymentSheet for Specialist booking + Villie Boxes checkout |

---

## 7 · Known limitations + open gates

Things attorney-gated, dashboard-blocked, or future-work that isn't on the roadmap yet but real users will eventually hit.

- **V4 Gear legal addendum body text** is placeholder. Counsel needs to write the real Addendum; we swap in via `LEGAL_DOC_VERSION` bump. See memory `project_gear_legal_addendum_placeholder.md`.
- **A2.c Account-delete cascade scrub** — current delete is soft-delete only. Real PII scrub blocked on retention-policy attorney sign-off.
- **Twilio A2P 10DLC** — US carriers silently drop SMS until registration. Toll-free is the ~1-day fast path. See memory `project_twilio_a2p_blocker.md`.
- **Specialist mobile mode (Option B)** — specialists who sign in via invite land on Mom-facing UI; no dedicated specialist screens yet. Threshold to ship: ≥30 specialists OR hospital partner demand. See memory `project_specialist_signin_path.md`.
- **V3 Connect tab is hidden** by product decision. C1-C5 code is shipped but not exposed. See memory `feedback_connect_tab_hidden.md`.
- **Newsletter chronic-bouncer auto-disable** — current behavior just logs to `admin_audit_log` on `email.bounced`. Future: flip `notif_prefs.newsletter=false` after N bounces in 30 days.
- **AASA on GH Pages** serves with `Content-Type: application/octet-stream` (no extension support). Apple's CDN is usually permissive on iOS 9+ since the bytes are valid JSON, but if validation fails on a real device, move villieapp.com to Cloudflare Pages / Netlify (both support custom Content-Type headers).
- **EAS project re-link** — projectId in app.json (`4b786f88-d387-4aba-a420-dfae6db88671`) is tied to the OLD `com.thevillage.app` bundle. Next EAS build will warn. `eas project:init` to re-link if/when it actually fails.

---

## 8 · Onboarding a new dev machine

```bash
# 1. clone
git clone https://github.com/musicfelipetrujillo-bot/village-app.git
cd village-app

# 2. install
pnpm install

# 3. seed .env (machine-local, gitignored)
cp apps/mobile/.env.example apps/mobile/.env  # if a template exists; otherwise copy from §2.1 above

# 4. iOS native generate + path-with-spaces patches
cd apps/mobile
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo prebuild --clean --platform ios
pnpm ios:patch

# 5. boot
pnpm start                            # Metro on :8081
# in another terminal:
cd ios && xcodebuild ...              # see §4 for the full xcodebuild line
```

You'll also need:
- A booted iOS Simulator (iPhone 17 / iOS 26.4 currently)
- Xcode 26+ installed
- Anthropic API key for testing AI fns locally (not strictly required if you only touch UI)

---

_Last updated: 2026-05-22 by Claude during a verification sprint. When you add new env vars or smoke tests, **update this file** — that's how it stays usable._
