# Pre-Launch Operational Runbook

**Purpose:** single consolidated checklist for everything that must be configured outside the codebase before The Village can serve real users. Generated 2026-04-24. Source of truth is still the individual phase rows in `CLAUDE.md` — this doc flattens them.

**How to use:** work top to bottom per environment (staging → prod). Each row lists *what*, *where to set*, and *what breaks if missing*.

---

## 0. Environments

| Env | Supabase project | Purpose |
|---|---|---|
| local | `supabase start` (Docker) | Dev-loop. No real SMS/push/payments. |
| staging | dedicated Supabase project | EAS preview + internal testers. Real Anthropic/Twilio/OneSignal on test credentials. No real Stripe charges. |
| prod | dedicated Supabase project | TestFlight + App Store. Real everything. |

**Never** share a Supabase project across envs — RLS policies, seed data, cron, and Storage buckets all live in the database.

---

## 1. Third-party accounts required

Each row = a signup that unblocks something. Check before starting env config.

| Service | Required for | Notes |
|---|---|---|
| **Anthropic** | Every AI feature (V2/V3/V4) — Haiku realtime + Sonnet batch | `ANTHROPIC_API_KEY`. Usage cap + billing alert recommended. |
| **Stripe** (standard + Connect) | V1 booking payments, V2 Milk Connect destination charges | Connect platform agreement must be signed. V4 Gear is cash-only (no Stripe) per 2026-04-23 decision. |
| **Twilio** | SMS: appointment reminders, purchase confirmations, crisis moderator alerts | `ACxxx` account SID + auth token + provisioned `+1` number. |
| **OneSignal** | Push: appointments, home feed, room weekly summaries, check-in reminders | Separate iOS + Android apps under one OneSignal app. Upload APNs `.p8` + FCM server key. |
| **Google Maps + Places + Geocoding** | Specialist map, milk donor map, gear pickup map, reverse-geocoding in CreateListing | One key per surface is fine; restrict by platform + API in Google Cloud Console. |
| **Calendly** | V1 specialist booking webhook | OAuth client + webhook signing secret. |
| **Sentry** | Mobile crash reporting | Separate DSN per env. PII scrubbing is already wired in `initSentry`. |
| **Shippo** | V2 M5 shipping labels (interstate donor→recipient) | Test keys fine for staging; live keys must pass Shippo KYC. |
| **SaferProducts.gov (CPSC)** | V4 G5 recall sync + per-listing recall check | Free public API; no key needed. |
| **Go-UPC** *or* **UPCitemdb** | V4 G5 barcode → product metadata (optional) | Either works; both absent degrades CreateListing to manual entry. |
| **Apple Developer + Google Play** | TestFlight + internal tracks | Required before EAS `submit`. |
| **NPI Registry** | V1 specialist NPI verification | No key, public API. 30-day cache already implemented. |

---

## 2. Environment variables

### 2.1 Mobile (`apps/mobile/.env` — bundled into the app via Expo)

All must be prefixed `EXPO_PUBLIC_` to be visible to the JS bundle.

| Var | Required | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | Public URL is safe to bundle. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon key — RLS enforces everything. |
| `EXPO_PUBLIC_API_BASE_URL` | ✅ | Usually `${SUPABASE_URL}/functions/v1`. |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | ✅ | Referrer-restricted. |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ (for V1+V2) | `pk_test_…` in staging, `pk_live_…` in prod. |
| `EXPO_PUBLIC_ONESIGNAL_APP_ID` | ✅ | Used by `useOneSignal`. |
| `EXPO_PUBLIC_SENTRY_DSN` | ✅ | Separate DSN per env. |
| `EXPO_PUBLIC_APP_ENV` | ✅ | `development | staging | production` — drives Sentry env tag. |
| `EXPO_PUBLIC_INTERNAL_AGENTS_ENABLED` | optional | `1` = compile the hidden `AGT` debug modal. Never `1` in prod builds. |

**Never bundle into mobile:** `AGENT_BASE_URL`, `AGENTS_BRIDGE_SECRET`, any `_SECRET_KEY`, any service role key.

### 2.2 Edge Function secrets (Supabase Dashboard → Settings → Functions → Secrets)

Auto-injected (do not set manually): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

| Secret | Used by | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | All AI functions (V1 ai-*, V2 milk-*, V3 room-*, V4 ai-*, home-feed-curator) | ✅ |
| `STRIPE_SECRET_KEY` | create-payment-intent, milk-stripe-connect, milk-purchase-*, stripe-webhook | ✅ (V1+V2) |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | ✅ (V1+V2) |
| `TWILIO_ACCOUNT_SID` | twilio-sms | ✅ |
| `TWILIO_AUTH_TOKEN` | twilio-sms | ✅ |
| `TWILIO_PHONE_NUMBER` | twilio-sms | ✅ |
| `CALENDLY_WEBHOOK_SECRET` | calendly-webhook | ✅ (V1) |
| `ONESIGNAL_APP_ID` | push-notify | ✅ |
| `ONESIGNAL_API_KEY` | push-notify | ✅ |
| `SHIPPO_API_KEY` | milk-shippo-label | ✅ (V2 M5) |
| `GO_UPC_API_KEY` | gear-upc-lookup | optional |
| `UPCITEMDB_API_KEY` | gear-upc-lookup (fallback) | optional |
| `PERKS_WEBHOOK_SECRET` | perks-redemption-webhook | ✅ (V4 G3, shared-secret stub until per-network sigs) |
| `AGENT_BASE_URL` | agents-health, agents-triage, agents-run | optional (internal only; feature-gated) |
| `AGENTS_BRIDGE_SECRET` | agents-* (forwarded as `x-agents-secret`) | optional |

### 2.3 Postgres database settings (GUCs)

Set once per project via `ALTER DATABASE`. These are how `pg_net` inside triggers/cron knows how to call back into Edge Functions.

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://<project>.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = '<service-role-jwt>';
```

**Production**: ⚠️ **Free Tier limitation (verified 2026-04-26)** — `ALTER DATABASE … SET app.*` requires the `supabase_admin` superuser, which is **not** exposed to the dashboard SQL Editor or the connection-pooler `postgres` role on Free Tier projects. Both `ALTER DATABASE postgres SET …` and `ALTER ROLE postgres IN DATABASE postgres SET …` return SQLSTATE `42501` (permission denied to set parameter). Workarounds:

1. **Pro tier + Supabase support** — file a support request on a Pro+ project; they unlock these GUCs manually. Cleanest long-term path.
2. **Refactor to Supabase Vault** — store the values via `vault.create_secret(secret, name)` and add a `SECURITY DEFINER` helper `app_setting(name)` that reads `vault.decrypted_secrets`. Migration cost: ~15 call-site edits across migrations 014/023/025/027/028/039.
3. **Deferred path (currently in use, 2026-04-26)** — leave the GUCs unset; the in-DB pg_cron HTTP-callout schedules silently no-op (URL concat returns NULL, `net.http_post` rejects NULL URL), and the broader cron schedule is run by `.github/workflows/supabase-crons.yml` instead. See §4.

**Local development**: run `scripts/setup-local-gucs.sh` after each `supabase db reset` (the reset wipes them — `pnpm supabase:reset` chains both for you). The script connects as `supabase_admin` (the only superuser in Supabase local) via TCP loopback inside the DB container. The Free-Tier limitation does NOT affect local — `supabase_admin` is exposed there.

**What breaks if missing (production):**
- V3 C4 AFTER-INSERT trigger (`scan_room_message_async`) silently no-ops — messages never get scanned. Fail-open policy means they're marked `clear` by default, so crisis detection stops working. **Connect tab is currently hidden (see memory `feedback_connect_tab_hidden.md`), so this is not an active gap.** Re-blocks before V3 ships.
- All pg_cron jobs that invoke Edge Functions no-op. **The GitHub Action workflow at `.github/workflows/supabase-crons.yml` is the operational executor today** (see §4).

**Verify in any environment:**
```sql
SELECT * FROM verify_app_gucs();
-- Both rows must show is_set = true.
```
Migration 029 also emits a `WARNING` in the migration log if either GUC is unset at apply time.

---

## 3. Supabase Storage buckets

| Bucket | Public read | Write policy | Used by | Created by |
|---|---|---|---|---|
| `gear-listings` | ✅ | Authenticated users can `INSERT` into `{auth.uid()}/*` paths only — 5MB cap, image MIME types only | G4 CreateListingScreen image uploads | Migration 022 (`INSERT INTO storage.buckets` + RLS policies) |

No other buckets are currently referenced by the app. Profile avatars and milk listing photos are mentioned in the spec but no screen uses them yet — add new buckets the same way (via a migration, not the dashboard, so they're tracked in version control).

**Verify after deploying migration 022:**
```sql
SELECT id, public, file_size_limit, allowed_mime_types
  FROM storage.buckets WHERE id = 'gear-listings';
-- Must return one row with public=t.
```

**What breaks if missing:** G4 `CreateListingScreen` photo upload returns `Bucket not found`. Listings can still be browsed, but no new ones can be created.

---

## 4. pg_cron jobs

⚠️ **On Free Tier, the in-DB pg_cron HTTP callouts no-op** because the GUCs in §2.3 can't be set. The schedules below are still defined in migrations 014/023/025/028/039 (so they show up under `SELECT * FROM cron.job`), but `current_setting('app.supabase_url')` returns NULL and `net.http_post` rejects the NULL URL. The schedules are operationally executed by **`.github/workflows/supabase-crons.yml`** instead.

`daily-checkin-reminder` is the exception — it's a pure SQL `INSERT` with no HTTP callout, so it continues to run inside pg_cron without GUCs.

Times are UTC.

| Job | Schedule | Calls | Migration | Where it runs today |
|---|---|---|---|---|
| `appointment-reminders` | every 15 min in pg_cron / `*/30` in GH Action (free-tier minute cap) | `appointment-reminder` edge fn | 014 | GH Action |
| `review-summary-refresh` | daily 03:00 ET (~07:00 UTC) | `refresh-stale-summaries` | 014 | GH Action |
| `gear-cpsc-recall-sync` | daily 06:00 UTC | `gear-cpsc-recall-sync` | 023 | GH Action |
| `ai-milestone-explainer-weekly` | Sunday 05:10 UTC | `ai-milestone-explainer` | 025 | GH Action |
| `home-feed-curator-daily` | daily 09:10 UTC | `home-feed-curator` (batch mode) | 025 | GH Action |
| `daily-checkin-reminder` | daily 12:00 UTC | inserts into `user_notifications_feed` → `push-notify` picks up | 025 | **pg_cron** (no HTTP — works without GUCs) |
| `room-weekly-summaries-sunday` | Sunday 11:00 UTC | `room-weekly-summary` (batch) | 028 | **disabled** — Connect tab hidden |
| `ai-weekly-journey-fill-nightly` | daily 04:00 UTC | `ai-weekly-journey-fill` (mode=missing, limit=5) | 039 | GH Action |

Verify pg_cron entries with: `SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;`
Verify GH Action runs in: GitHub → Actions → "Supabase scheduled crons".

### 4.1 GitHub Action setup

The workflow at `.github/workflows/supabase-crons.yml` requires two repo secrets:

| Secret | Value | Where to find |
|---|---|---|
| `SUPABASE_PROJECT_REF` | e.g. `albyndcruwopulazvpjs` | Supabase dashboard URL slug |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role JWT | Supabase Dashboard → Project Settings → API → `service_role` key (or `supabase projects api-keys --project-ref <ref>` from the CLI) |

Add via repo Settings → Secrets and variables → Actions → New repository secret. After adding, push the workflow file — first scheduled run starts within ~30 minutes.

On-demand: GH Actions UI → "Supabase scheduled crons" → Run workflow → pick a function + optional JSON body. Useful for backfilling weeks via `ai-weekly-journey-fill` with a custom limit.

**Why these schedules differ from pg_cron:** GH Actions free-tier private repos cap at 2000 minutes/month. Each scheduled invocation costs ~1 billable minute. The original `*/15` appointment-reminder schedule alone would consume ~2880 min/month, exceeding the cap. `*/30` keeps reminder latency under 30 minutes (well within the function's ±30-minute look-back windows) and brings monthly cost to ~1500 minutes for the full schedule set.

**Once V3 Connect tab ships:** uncomment the `room-weekly-summaries-sunday` schedule in the workflow, AND ensure GUCs are set (Pro tier or Vault refactor) so `scan_room_message_async` fires for crisis detection.

---

## 5. Database-level seeds / operational data

These are not code, but must exist in prod for features to work:

| Seed need | Phase | How | Without it |
|---|---|---|---|
| Specialist directory (Miami, ~30 entries) | V1 | Manual insert or CSV via Supabase Studio using `docs/source/Miami_Specialist_Directory.md` | Experts tab is empty |
| At least 1 admin user (`users.is_admin=TRUE`) | V1 | Set manually after user signs up | `admin-approve-specialist` edge fn 403s |
| Events (real ones, not the 4 seeds from 010) | V4 G2 | Manual/partner-feed/API — decision open | EventsList shows 4 test events |
| Brand deals (real partner offers) | V4 G3 | Insert into `brand_deals` after partnerships sign | Perks list shows 4 seeds |
| Moderators per room (`room_moderators.is_active=TRUE`) | V3 C4 | Insert after V3 gets launched | Crisis flags have no one to notify via Twilio |
| PPD pinned crisis hotlines | V3 C1 | Already seeded in migration 006 | — |

---

## 6. Native build config (app.json / EAS)

| Item | Where | Notes |
|---|---|---|
| `expo.ios.bundleIdentifier` | app.json | `com.thevillage.app` (TBD) — must match App Store Connect |
| `expo.android.package` | app.json | Same reverse-DNS |
| OneSignal plugin config | app.json `plugins` array | App ID + mode |
| Sentry plugin config | app.json `plugins` array | Upload source maps on build |
| Stripe plugin | app.json `plugins` | Merchant ID for Apple Pay |
| `expo-location` usage description | app.json iOS `infoPlist` | "We use location to show nearby donors/gear/events." Required for App Store review. |
| `expo-camera` usage description | iOS `infoPlist` | "Scan barcodes on baby gear for safety checks." |
| `expo-image-picker` usage description | iOS `infoPlist` | "Upload photos of items you're listing." |
| `expo-calendar` usage description | iOS `infoPlist` | "Add events you RSVP to your calendar." |
| `expo-clipboard` | (no permission) | — |
| EAS build profiles | `eas.json` | dev / preview / prod — already configured in Phase 10 |
| OTA update channel | `eas.json` | `production` channel for App Store |

---

## 7. Legal / compliance gates

Gated on attorney sign-off — not code.

| Vertical | Gate | Status |
|---|---|---|
| V2 Milk | Stripe Connect platform agreement signed | ⚪ Pending |
| V2 Milk | Legal Disclosure v1 copy reviewed (M5) | ⚪ Pending |
| V4 Gear | CPSC Prohibited Items Policy published (G5 attorney P2 review, ~$500–1K) | ⚪ Pending |
| V4 Gear | Gear Terms Addendum published (G6) | ⚪ Pending |
| V4 Gear | DMCA-style takedown SOP — named 24hr assignee | ⚪ Pending |
| V4 Gear | FDUTPA review of Gear in-app copy | ⚪ Pending |
| V4 Gear | Marketplace GL + E&O insurance coverage confirmed | ⚪ Pending |
| V4 Gear | FinCEN / Florida money-transmitter counsel — cash-only confirmed OK | 🟢 Resolved via cash-only MVP |
| V3 Community | Crisis drill + moderator runbook | ⚪ Deferred (tab hidden) |
| V3 Community | 50-user beta + anon-table RLS audit | ⚪ Deferred (tab hidden) |
| All | Privacy Policy + Terms of Service published URL | ⚪ Pending |
| All | App Store / Play Store listings, screenshots, age rating | ⚪ Pending |

---

## 8. Smoke test checklist (first real-device build)

Run on a fresh TestFlight install. Each failure = a bug to open before next build.

**Onboarding**
- [ ] Sign up with email → verification → OnboardingProfile completes → lands on Home
- [ ] BabyProfileSetup flow saves DOB / preemie / gender / feeding → HomeScreen shows milestone

**V1 Experts**
- [ ] ExpertsHome loads specialists within 25mi (seeded Miami data)
- [ ] SpecialistProfile opens → AI Q&A modal returns an answer
- [ ] Book → pick slot → PaymentSheet → BookingConfirm
- [ ] Appointment reminder push arrives at 1hr and 15min

**V2 Milk**
- [ ] Become donor → questionnaire → Stripe Connect onboarding completes
- [ ] DonorSearchList shows donors, map renders pins
- [ ] AI Match returns ranked list
- [ ] Purchase → legal disclosure modal → payment → confirm → pickup address reveals
- [ ] Messaging thread works both directions

**V4 Gear**
- [ ] GearBrowse loads, category filters work
- [ ] CreateListing → barcode scan populates title/brand, photo upload succeeds
- [ ] CPSC check runs on submit (recalled item → hard block modal)
- [ ] Open listing → Report flow works, Message seller flow gates on legal + safe-meeting modals
- [ ] Saved listings persist

**V4 Home**
- [ ] Daily check-in banner appears, submit → Villie reply renders
- [ ] Home feed cards render (milestone hero + events + perks + gear tip + discover tiles)
- [ ] Crisis test phrase triggers crisis resources card with working `tel:` deeplinks

**Cross-cutting**
- [ ] Sentry captures a forced error with correct env tag
- [ ] OneSignal external_id registers on login (check dashboard)
- [ ] Deep link `village://community/room/*` opens the app (once Connect is unhid)
- [ ] Logout → login persists previous state

---

## 9. Known gaps / deferred

- **V3 Community** entire tab — `AppNavigator.tsx` does not mount the Connect tab; C3/C6/C7 are not being built per product call (2026-04-24).
- **eBay Marketplace Insights API** — application should be submitted now; 4–6 week approval blocks G5 smart pricing. Depreciation-table fallback is already live.
- **Affiliate network activation (G3)** — `brand_deals.affiliate_network` enum + `{subid}` plumbing exists, but no network is signed. Claims record as `status='clicked'` until Impact/ShareASale/CJ contracts land.
- **Event ingestion strategy (G2)** — 4 seed events only. Need decision: manual curation vs. partner feed vs. API scrape.
- **Moderator dashboard screen (V3 C4)** — three moderator RPCs live, screen deferred (tab hidden).

---

**Last updated:** 2026-04-24 — after full `supabase db reset` + typecheck + lint + types regen pass.
