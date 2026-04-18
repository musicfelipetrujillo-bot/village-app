# The Village App — Complete Master Plan
## All 4 Verticals + Home Dashboard

> Source of truth: `/Users/felipetrujillo/Desktop/village-app.html`
> Implementation order: V1 → V2 → V3 → V4+Home (one vertical live before starting next)

---

## App Overview

The Village is a maternal health platform for moms (expecting + postpartum). 5-tab mobile app:

| Tab | Vertical | Core Function |
|---|---|---|
| 🏠 Home | Dashboard | Milestone tracker, quick access, personalized feed |
| 🤱 Milk | V2 — Milk Connect | Peer breast milk donor marketplace |
| 🩺 Experts | V1 — Specialist Directory | Find & book OB/GYN, Doula, Midwife, etc. |
| 💬 Village | V3 — Community Rooms | Live, moderated chat rooms by stage |
| ✦ Discover | V4 — Discover | Events, brand perks, baby gear exchange |

---

## Shared Tech Stack

| Layer | Tool |
|---|---|
| Mobile | React Native (bare workflow, iOS + Android) |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| File Storage | Supabase Storage |
| AI | Claude API — `claude-haiku-4-5` (~$0.001/call) |
| Maps | Google Maps + Google Places API |
| Booking | Calendly (v1) → Zocdoc (v2 partnership) |
| Payments | Stripe + Stripe Connect |
| SMS | Twilio |
| State Mgmt | Zustand |
| Monorepo | Turborepo + pnpm workspaces |

---

## Master Implementation Order

```
Phase 0:   Infrastructure & monorepo (all shared)
V1 Phases 1–10:  Specialist Directory LIVE
V2 Phases M1–M5: Milk Connect LIVE
V3 Phases C1–C7: Community Rooms LIVE
V4 Phases D1–D6: Discover + Home Dashboard LIVE
```

---

---

# VERTICAL 1 — Specialist Directory
### OB/GYN · Midwives · Doulas · Lactation Consultants · Pediatricians

---

## V1 — Database Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL, phone TEXT, full_name TEXT NOT NULL,
  avatar_url TEXT,
  pregnancy_stage TEXT CHECK (pregnancy_stage IN (
    'trying','first_trimester','second_trimester','third_trimester',
    'postpartum_0_6mo','postpartum_6_12mo','postpartum_1yr_plus')),
  due_date DATE,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en','es','ht')),
  insurance_provider TEXT, zip_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE specialists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  npi_number TEXT UNIQUE NOT NULL,
  npi_verified BOOLEAN DEFAULT FALSE, npi_verified_at TIMESTAMPTZ,
  full_name TEXT NOT NULL, credentials TEXT NOT NULL,
  specialty TEXT NOT NULL CHECK (specialty IN (
    'ob_gyn','midwife','doula','lactation_consultant','pediatrician')),
  bio TEXT, photo_url TEXT, practice_name TEXT,
  address_line1 TEXT, city TEXT, state TEXT, zip_code TEXT,
  lat DECIMAL(10,7), lng DECIMAL(10,7),
  phone TEXT, website_url TEXT,
  telehealth_available BOOLEAN DEFAULT FALSE, telehealth_link TEXT,
  accepting_patients BOOLEAN DEFAULT TRUE, years_experience INT,
  rating_avg DECIMAL(3,2) DEFAULT 0.00, review_count INT DEFAULT 0,
  review_summary_cache TEXT, review_summary_cached_at TIMESTAMPTZ,
  zocdoc_provider_id TEXT, calendly_username TEXT, stripe_account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_specialists_specialty ON specialists(specialty);
CREATE INDEX idx_specialists_location ON specialists USING GIST(ll_to_earth(lat,lng));

CREATE TABLE specialist_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL, UNIQUE (specialist_id, language_code));

CREATE TABLE specialist_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  insurance_name TEXT NOT NULL, plan_type TEXT,
  UNIQUE (specialist_id, insurance_name, plan_type));

CREATE TABLE specialist_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL, description TEXT,
  price_cents INT, duration_min INT, UNIQUE (specialist_id, service_name));

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT, ai_summary TEXT, verified_patient BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (specialist_id, user_id));

CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (user_id, specialist_id));

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('zocdoc','calendly','in_app')),
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','confirmed','cancelled','completed','no_show')),
  appointment_at TIMESTAMPTZ NOT NULL, duration_min INT DEFAULT 60,
  service_type TEXT, is_telehealth BOOLEAN DEFAULT FALSE, telehealth_link TEXT,
  notes TEXT, stripe_payment_intent_id TEXT, amount_cents INT,
  twilio_reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  body TEXT NOT NULL, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialist_id UUID REFERENCES specialists(id) ON DELETE SET NULL,
  skill_type TEXT NOT NULL CHECK (skill_type IN (
    'match','profile_qa','translate','review_summary',
    'appointment_reminder','followup_questions','triage')),
  messages JSONB NOT NULL DEFAULT '[]', context_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE specialist_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL, field_name TEXT NOT NULL,
  content_hash TEXT NOT NULL, translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (specialist_id, language_code, field_name, content_hash));

CREATE TABLE npi_cache (
  npi_number TEXT PRIMARY KEY, raw_response JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW());
```

## V1 — Backend API Routes

**Base:** `GET/POST /specialists` · `/specialists/nearby` · `/specialists/:id` · `/specialists/:id/reviews` · `/specialists/:id/services` · `/specialists/:id/availability`

**Booking:** `GET /booking/calendly/:id/slots` · `POST /booking/calendly/webhook` · `GET /booking/zocdoc/:id/slots`

**Payments:** `POST /payments/intent` · `POST /payments/webhook`

**AI (7 skills):** `POST /ai/match` · `/ai/profile-qa` · `/ai/translate` · `/ai/review-summary` · `/ai/appointment-reminder` · `/ai/followup-questions` · `/ai/triage`

**Other:** `/auth/*` · `/users/me/*` · `/reviews` · `/appointments` · `/messages` · `/npi/verify/:npi` · `/admin/*`

**Search query params:** `?specialty=&language=&insurance=&telehealth=&lat=&lng=&radius_miles=&sort=distance|rating|name&page=&limit=`

## V1 — Screen Architecture

```
AuthStack: Splash → Onboarding (3-step) → SignUp → Login → ForgotPassword → OnboardingProfile

AppNavigator (Bottom Tabs):
├── Search Tab
│   ├── SearchHomeScreen       (search bar + specialty pills + AI match entry)
│   ├── FilterScreen           (language, insurance, telehealth, distance)
│   ├── ResultsListScreen      (sorted SpecialistCards)
│   ├── ResultsMapScreen       (Google Maps + specialty-colored pins)
│   ├── SpecialistProfileScreen ← HIGHEST TRAFFIC
│   │   ├── ProfileHeroSection (avatar, name, credentials, telehealth badge)
│   │   ├── ActionBar (Favorite ♥ | Book | Message | Share)
│   │   ├── RatingRow (stars + count + AI Summary button)
│   │   ├── InfoTabs (About | Services | Insurance | Location+MiniMap)
│   │   ├── ReviewsList (ReviewCards + WriteReview)
│   │   └── AIAssistantRail ("Ask about Dr. X" | "Suggest questions")
│   ├── BookingScreen          (Calendly slot picker or in-app form)
│   ├── PaymentScreen          (Stripe PaymentSheet)
│   ├── BookingConfirmScreen
│   ├── ReviewSubmitScreen
│   └── MessagingScreen
├── My Village Tab → FavoritesScreen (saved providers grid)
├── Appointments Tab → List → Detail → TelehealthLaunch (WebView)
├── AI Assistant Tab → AIHome → Match | Triage | ProfileQA → AIConversation
└── Profile Tab → Profile → Edit → Insurance → Language (en/es/ht) → Notifications → Account
```

## V1 — 7 AI Skills (Claude Haiku)

| # | Skill | Trigger | Key Prompt Design |
|---|---|---|---|
| 1 | Match Mom to Specialist | `/ai/match` | Inject pregnancy_stage + nearby specialists JSON → recommend 2–3 with warm reasoning |
| 2 | Profile Q&A Bot | `/ai/profile-qa` | Inject specialist profile data → answer only from provided data, ≤3 sentences |
| 3 | Translate Profiles | `/ai/translate` | Target lang (es/ht) → faithful medical translation, cached by content_hash |
| 4 | Summarize Reviews | `/ai/review-summary` | "Moms say..." 2–3 sentences, note top praise + top concern, cached on specialist row |
| 5 | Appointment Reminder | Cron 48h+2h | Warm contextual reminder → Twilio SMS + push notification |
| 6 | Follow-up Questions | `/ai/followup-questions` | 5–7 specific questions tailored to specialty + pregnancy stage |
| 7 | Triage | `/ai/triage` | Emergency detection FIRST → direct 911; then match to provider type |

## V1 — Key Integrations

- **Google Maps/Places:** Map view pins, geocoding on specialist create, address autocomplete, `earthdistance` extension for radius queries
- **Calendly:** OAuth connect for specialists, slot fetch, `invitee.created` webhook → upsert appointments
- **Zocdoc:** v2 (requires partnership) — fallback to Calendly for v1
- **Stripe Connect:** PaymentIntent with `transfer_data.destination`, Express onboarding, webhook confirmation
- **Twilio:** Cron every 15min for 48h + 2h reminders
- **NPI Registry:** License verification, cached 30 days in `npi_cache`

## V1 — Build Sequence (55 days, 10 phases)

| Phase | Days | Goal |
|---|---|---|
| 0 | 1–3 | Monorepo, Supabase project, Express + RN bootstrap, all API keys |
| 1 | 4–6 | Auth + onboarding (pregnancy stage, insurance, zip, language) |
| 2 | 7–12 | Specialist search: seed data, geo-query API, List + Map + Profile screens |
| 3 | 13–16 | Favorites + Reviews (optimistic updates, rating recalculation trigger) |
| 4 | 17–23 | Booking + Payments (Calendly OAuth, slot picker, Stripe PaymentSheet) |
| 5 | 24–27 | Messaging + Telehealth deeplinks |
| 6 | 28–36 | All 7 AI skills (build in order: Review Summary → Translate → QA → Follow-up → Match → Triage → Reminder) |
| 7 | 37–40 | NPI verification badge + admin approval queue |
| 8 | 41–43 | SMS reminders cron + push notifications |
| 9 | 44–50 | Polish: skeletons, empty states, RLS audit, accessibility, FlashList |
| 10 | 51–55 | Launch: prod Supabase, Railway deploy, Sentry, analytics, 20 beta users |

**Critical files:** `001_initial_schema.sql` · `ai/aiService.ts` · `RootNavigator.tsx` · `SpecialistProfileScreen.tsx` · `ai.routes.ts`

---

---

# VERTICAL 2 — Milk Connect
### Peer breast milk donor marketplace

> Built after V1 is fully live in production.

---

## V2 — Database Schema

```sql
CREATE TABLE milk_donor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name VARCHAR(100) NOT NULL, avatar_url TEXT,
  neighborhood VARCHAR(150), city VARCHAR(100), state VARCHAR(50), zip_code VARCHAR(10),
  lat DECIMAL(10,7), lng DECIMAL(10,7), bio TEXT,
  price_per_oz DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  supply_oz_available INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false, is_verified BOOLEAN NOT NULL DEFAULT false,
  stripe_account_id TEXT, stripe_onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_donor_profiles_location ON milk_donor_profiles USING GIST(ll_to_earth(lat,lng));

CREATE TABLE milk_trust_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id UUID NOT NULL REFERENCES milk_donor_profiles(id) ON DELETE CASCADE UNIQUE,
  questionnaire_complete BOOLEAN NOT NULL DEFAULT false, questionnaire_completed_at TIMESTAMPTZ,
  bloodwork_linked BOOLEAN NOT NULL DEFAULT false, bloodwork_verified_at TIMESTAMPTZ,
  bloodwork_report_url TEXT, diet_disclosed BOOLEAN NOT NULL DEFAULT false,
  medications_disclosed BOOLEAN NOT NULL DEFAULT false,
  badge_level VARCHAR(30) NOT NULL DEFAULT 'none'
    CHECK (badge_level IN ('none','basic','verified','verified_bloodwork')),
  ai_safety_score DECIMAL(4,2), ai_safety_flags JSONB, ai_last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE milk_questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id UUID NOT NULL REFERENCES milk_donor_profiles(id) ON DELETE CASCADE,
  question_key VARCHAR(100) NOT NULL, question_text TEXT NOT NULL, answer_value TEXT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(donor_profile_id, question_key));

CREATE TABLE milk_donor_diet_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id UUID NOT NULL REFERENCES milk_donor_profiles(id) ON DELETE CASCADE,
  flag_key VARCHAR(60) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(donor_profile_id, flag_key));
-- flag_key values: 'dairy_free','organic','gluten_free','vegan','nut_free'

CREATE TABLE milk_donor_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id UUID NOT NULL REFERENCES milk_donor_profiles(id) ON DELETE CASCADE,
  medication_name VARCHAR(200) NOT NULL, dosage VARCHAR(100), frequency VARCHAR(100),
  notes TEXT, is_current BOOLEAN NOT NULL DEFAULT true);

CREATE TABLE milk_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id UUID NOT NULL REFERENCES milk_donor_profiles(id) ON DELETE CASCADE,
  oz_available INTEGER NOT NULL CHECK (oz_available > 0),
  price_per_oz DECIMAL(5,2) NOT NULL, min_order_oz INTEGER NOT NULL DEFAULT 4,
  pickup_available BOOLEAN NOT NULL DEFAULT true,
  shipping_available BOOLEAN NOT NULL DEFAULT false, shipping_price DECIMAL(6,2),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','sold_out','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE milk_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES milk_listings(id),
  donor_profile_id UUID NOT NULL REFERENCES milk_donor_profiles(id),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id),
  oz_purchased INTEGER NOT NULL, price_per_oz DECIMAL(5,2) NOT NULL,
  subtotal_cents INTEGER NOT NULL, platform_fee_cents INTEGER NOT NULL,  -- 15%
  total_charged_cents INTEGER NOT NULL, donor_payout_cents INTEGER NOT NULL,
  stripe_payment_intent TEXT NOT NULL, stripe_transfer_id TEXT,
  fulfillment_method VARCHAR(20) NOT NULL CHECK (fulfillment_method IN ('pickup','shipping')),
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','fulfilled','disputed','refunded','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE milk_message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id UUID NOT NULL REFERENCES milk_donor_profiles(id),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id),
  listing_id UUID REFERENCES milk_listings(id), last_message_at TIMESTAMPTZ,
  UNIQUE(donor_profile_id, recipient_user_id));

CREATE TABLE milk_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES milk_message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL, is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE milk_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES milk_transactions(id) UNIQUE,
  donor_profile_id UUID NOT NULL REFERENCES milk_donor_profiles(id),
  reviewer_user_id UUID NOT NULL REFERENCES auth.users(id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT, response_body TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE milk_saved_donors (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  donor_profile_id UUID NOT NULL REFERENCES milk_donor_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, donor_profile_id));
```

**RLS key rules:** Donors update own profile only. Active donors readable by all. Messages only to thread participants. `milk_trust_badges` readable by all (badge level), writable only by service role.

## V2 — Backend API Routes

**Search:** `GET /milk/donors/search?lat=&lng=&radius_miles=&min_price=&max_price=&diet_flags=&bloodwork_verified=&badge_level=&sort=distance|price_asc|rating&page=`

**Donors:** `GET/POST /milk/donors` · `/milk/donors/me` · `/milk/donors/:id`

**Trust Badge:** `POST /milk/donors/me/questionnaire` · `/me/trust-badge/bloodwork` · `/me/trust-badge/diet-flags` · `/me/trust-badge/medications` · `/me/trust-badge/evaluate`

**Listings:** `GET/POST/PUT/DELETE /milk/listings` · `/milk/listings/:id/status`

**Transactions:** `POST /milk/transactions/intent` → returns `client_secret` · `POST /milk/transactions/:id/confirm` · `PUT /milk/transactions/:id/fulfill` · `POST /milk/transactions/:id/dispute`

**Messaging:** `GET/POST /milk/threads` · `GET/POST /milk/threads/:id/messages`

**Stripe Connect:** `POST /milk/stripe/connect/onboard` (returns onboarding URL) · `GET /milk/stripe/connect/status` · `POST /milk/stripe/webhooks`

**AI:** `POST /milk/ai/match-donors` · `/milk/ai/donor-qa` · `/milk/ai/safety-evaluate` (internal)

## V2 — Screen Architecture

```
MilkConnectNavigator
├── MilkConnectHomeScreen       (Browse / Become a Donor role selector)
├── Recipient Flow
│   ├── DonorMapScreen          (Google Maps full-screen, badge-colored pins)
│   ├── DonorSearchListScreen   (FilterDrawerModal: diet, price, distance, badge)
│   ├── DonorProfileScreen ← CENTERPIECE
│   │   ├── ProfileHeader (avatar, name, verified icon, distance, Save ♥)
│   │   ├── TrustBadgeCard (badge level pill, checklist, AI safety score bar)
│   │   ├── PricingAvailabilityCard ($/oz, oz available, min order, pickup/ship)
│   │   ├── DietMedicationCard (diet flag chips, medication status)
│   │   ├── BloodworkStatusCard (if linked: masked reference, PDF viewer)
│   │   ├── AIMatchNarrativeCard ("Based on your dairy-free preference...")
│   │   ├── ReviewsSection (stars + ReviewCards)
│   │   └── ActionBar sticky (Message | Purchase Milk) + AI Q&A floating button
│   ├── SavedDonorsScreen
│   └── PurchaseHistoryScreen
├── Donor Flow (visible only if donor profile exists)
│   ├── DonorDashboardScreen    (earnings, active listings, badge status)
│   ├── DonorListingManagerScreen → CreateEditListingModal
│   ├── DonorOrdersScreen → OrderDetailModal (mark fulfilled)
│   ├── DonorEarningsScreen     (Stripe payout history)
│   └── DonorSettingsScreen
├── BecomeDonorFlow (Stack)
│   ├── BecomeDonorIntroScreen  (4-step overview, "Earn ~$1,200/mo")
│   ├── DonorQuestionnaireScreen (12 questions + AI coach guidance per step)
│   ├── TrustBadgeBuilderScreen → BloodworkUploadModal | DietFlagsModal | MedicationsModal
│   ├── CreateListingScreen
│   └── StripeOnboardingScreen  (WebView → Stripe Express)
└── MessagingStack → ThreadsScreen → MessageDetailScreen
```

## V2 — 5 AI Skills

| # | Skill | Purpose | Key Design |
|---|---|---|---|
| 1 | Donor Safety Screener | Evaluate questionnaire for infant safety risks | Returns JSON `{safety_score, flags[{severity: block|warn|note}]}` — `block` auto-deactivates listing |
| 2 | Recipient-Donor Matcher | Rank donors by compatibility with recipient's needs | Injects diet needs, budget, distance, badge level → ranked IDs + match narratives |
| 3 | Donor Profile Q&A | Answer recipient questions about a specific donor | Only answers from provided profile data, never speculates, ≤100 words |
| 4 | Trust Score Narrative | "Sarah is a strong match because..." shown on profile | Cached 24h, warm + factual, references specific badge attributes |
| 5 | Questionnaire Coach | Guide donor through each question with context | 1-sentence why-it-matters + acknowledgement per answer, flags potential concerns |

**Safety rule:** AI `block` flag = auto-deactivate listing + Twilio SMS to donor. Bloodwork verification always requires human review (not AI-automated).

## V2 — Key Integrations

- **Google Maps:** Neighborhood-level pins (not exact address), custom badge-colored markers, distance via Haversine
- **Stripe Connect Express:** 15% platform fee via `application_fee_amount`, Express onboarding in WebView, 2-day rolling payouts
- **Twilio:** Order notifications to both parties, safety block notifications to donor
- **Bloodwork Verification:** v1 = manual PDF review via Supabase admin; v2 = Health Gorilla or Truepill API
- **Exact address:** Revealed only post-payment via Twilio SMS (never shown in app before purchase)

## V2 — Build Sequence (12 weeks / 5 phases)

| Phase | Weeks | Goal |
|---|---|---|
| M1 | 1–3 | DB migration, Become-a-Donor flow, questionnaire + AI coach, trust badge builder, Stripe Connect onboarding |
| M2 | 4–6 | Listing CRUD, map discovery with pins, search+filter, DonorProfileScreen, SavedDonors |
| M3 | 7–9 | AI match + trust narrative on profile, purchase flow (Stripe PaymentIntent), Twilio order SMS |
| M4 | 10 | Messaging threads, reviews system, rating recalculation |
| M5 | 11–12 | Dispute flow, shipping integration (Shippo v2), legal disclosure modal, analytics funnel |

**Critical files:** `milk_connect_schema.sql` · `ai/milk/safetyScreener.ts` · `services/milk/transactionService.ts` · `screens/milk/DonorProfileScreen.tsx`

---

---

# VERTICAL 3 — Community Rooms
### Live · Local · Moderated chat rooms by stage and topic

> Built after V2 is fully live. Most safety-critical vertical in the app.

---

## V3 — Architecture Principles

1. **Anonymous mode is a security boundary, not a UI preference.** Enforced server-side only. Client never holds user_id → alias mapping.
2. **Crisis detection is synchronous on the write path.** Every message scanned before insertion. A crisis message cannot reach the room unmoderated, even for 2 seconds.
3. **Realtime filter is server-side.** `ai_scan_status=eq.clear` filter applied before payload leaves Supabase — flagged messages never reach the client over the wire.

## V3 — Database Schema

```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- 'miami-moms-week-10-16'
  name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '💬', description TEXT NOT NULL,
  room_type TEXT NOT NULL CHECK (room_type IN ('stage_local','topic','support')),
  color_theme TEXT NOT NULL DEFAULT 'rust'
    CHECK (color_theme IN ('rust','olive','brown','cream')),
  city TEXT,                           -- NULL = global
  stage_week_min SMALLINT, stage_week_max SMALLINT,
  anonymous_mode TEXT NOT NULL DEFAULT 'optional'
    CHECK (anonymous_mode IN ('none','optional','mandatory')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  member_count INTEGER NOT NULL DEFAULT 0,  -- denormalized via trigger
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  notif_pref TEXT NOT NULL DEFAULT 'mentions' CHECK (notif_pref IN ('all','mentions','none')),
  UNIQUE (room_id, user_id));

-- SAFETY-CRITICAL: service role access only. RLS denies all authenticated queries.
CREATE TABLE user_anonymous_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anon_alias TEXT NOT NULL,            -- "Gentle Sparrow"
  anon_avatar_seed TEXT NOT NULL,      -- SHA-256(room_id+user_id)[:8]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id), UNIQUE (room_id, anon_alias));
ALTER TABLE user_anonymous_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_identity_deny_all ON user_anonymous_identities USING (FALSE);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_anon_id UUID REFERENCES user_anonymous_identities(id) ON DELETE SET NULL,
  CONSTRAINT chk_sender CHECK (
    (sender_user_id IS NOT NULL AND sender_anon_id IS NULL) OR
    (sender_user_id IS NULL AND sender_anon_id IS NOT NULL)),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  message_type TEXT NOT NULL DEFAULT 'user'
    CHECK (message_type IN ('user','system','ai_companion','expert')),
  parent_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE, deleted_at TIMESTAMPTZ, deleted_by UUID,
  ai_scan_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ai_scan_status IN ('pending','clear','flagged','crisis')),
  ai_scan_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_messages_room_feed ON messages(room_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_messages_crisis ON messages(room_id, created_at DESC) WHERE ai_scan_status = 'crisis';

CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('❤️','🤗','💪','😂','😢','🙏')),
  UNIQUE (message_id, user_id, emoji));

CREATE TABLE room_moderators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'moderator' CHECK (role IN ('moderator','lead_moderator','expert')),
  credential_label TEXT,               -- 'IBCLC', 'Sleep Coach'
  calendly_event_type_uri TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE (room_id, user_id));

CREATE TABLE pinned_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL, resource_type TEXT NOT NULL
    CHECK (resource_type IN ('crisis_hotline','article','booking_link','event')),
  url TEXT, phone_number TEXT, display_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE);
-- Seed: 988, PSI (1-800-944-4773), Crisis Text Line (HOME to 741741) for PPD room

CREATE TABLE crisis_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id),
  flagged_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  trigger_phrases TEXT[], ai_assessment TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','escalated','resolved')),
  moderator_id UUID REFERENCES auth.users(id), moderator_notes TEXT,
  sms_sent BOOLEAN NOT NULL DEFAULT FALSE, sms_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ);
CREATE INDEX idx_crisis_open ON crisis_flags(severity, created_at DESC) WHERE status = 'open';

CREATE TABLE room_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  moderator_id UUID NOT NULL REFERENCES room_moderators(id),
  title TEXT NOT NULL, description TEXT,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  calendly_event_uri TEXT, rsvp_count INTEGER NOT NULL DEFAULT 0,
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE);

CREATE TABLE room_presence (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id));
-- Cleanup: DELETE WHERE last_seen_at < NOW() - INTERVAL '5 minutes' (cron every 5min)
```

## V3 — Backend API Routes

**Rooms:** `GET /community/rooms` (with stage-match scoring) · `GET /community/rooms/:id` · `POST /community/rooms/:id/join` · `DELETE /community/rooms/:id/leave`

**Messages (critical write path):** `POST /community/rooms/:id/messages` → runs Crisis Detection + Content Moderation in parallel (`Promise.all`, 3s timeout) BEFORE insert → `GET /community/rooms/:id/messages?cursor=&limit=30`

**Anonymous:** `POST /community/rooms/:id/anonymous-identity` (word-list alias generation: 200 adjectives × 200 nouns) · `DELETE /community/rooms/:id/anonymous-identity`

**Reactions:** `POST/DELETE /community/rooms/:id/messages/:msgId/reactions/:emoji`

**Moderation (requires `requireModerator` middleware):** `GET /moderation/flags` · `PATCH /moderation/flags/:id` · `DELETE /moderation/rooms/:id/messages/:msgId` · `POST /moderation/rooms/:id/mute/:userId`

**Events:** `POST /community/events` · `PATCH /community/events/:id` · `POST /community/events/:id/rsvp`

**Webhooks:** `POST /webhooks/calendly` (creates room_events from Calendly bookings)

## V3 — Screen Architecture

```
VillageStack:
├── CommunityHomeScreen     (room discovery, stage-match banner, filter chips)
├── RoomChatScreen ← CORE EXPERIENCE
│   ├── RoomChatHeader      (room name, active count with live dot)
│   ├── ExpertEventBanner   (if drop-in happening today)
│   ├── PinnedResourcesBar  (always visible in PPD room, collapsible elsewhere)
│   ├── MessageFeed (inverted FlatList, optimistic send with pending state)
│   │   ├── UserMessage     (NamedBubble or AnonBubble by alias+avatar seed)
│   │   ├── ExpertBubble    (gold border + credential label)
│   │   ├── AICompanionBubble (triggered by @village mention)
│   │   └── SystemMessage
│   ├── CrisisResourcesSheet (shown after crisis-detected message: 988, PSI, Crisis Text)
│   └── MessageInputBar     (anon toggle if optional room + icebreaker suggestion)
├── AnonymousOnboardingScreen (disclosure: moderators can de-anonymize for safety)
├── RoomInfoScreen          (pinned resources, members, upcoming events)
├── ExpertEventScreen       (drop-in detail + RSVP + countdown)
├── ModeratorDashboardScreen ← moderator-only
│   ├── Crisis Flags tab    (open flags by severity)
│   ├── Flagged Messages tab (approve / delete)
│   └── Room Activity tab   (live count, messages/hour, muted users)
├── CrisisFlagDetailScreen  ← moderator-only
└── RoomSearchScreen        (filter by type, city, stage)
```

**Realtime subscription design:**
```
Channel room:{roomId}:
  postgres_changes → INSERT on messages
  filter: room_id=eq.{roomId} AND ai_scan_status=eq.clear  ← server-side filter

Channel room:{roomId}:presence:
  Supabase Presence → active count via Object.keys(state).length
  Track: { user_hash: SHA256(userId)[:8], joined_at }  ← never raw user_id
```

## V3 — 6 AI Skills

| # | Skill | Model | On Write Path? | Key Design |
|---|---|---|---|---|
| 1 | Crisis Detection | Haiku, temp=0 | YES (sync) | JSON `{severity: none|low|medium|high|critical, crisis_type, safe_message}` — high/critical → crisis_flags + Twilio SMS to moderator |
| 2 | Content Moderation | Haiku, temp=0 | YES (parallel) | JSON `{flagged, category, confidence}` — high confidence → `ai_scan_status='flagged'`, pending moderator review |
| 3 | AI Companion | Haiku, temp=0.4 | NO (triggered by @village) | Warm 2–4 sentence responses; if crisis detected in @village message → returns `{crisis_detected:true}` instead |
| 4 | Room Summary | Haiku, weekly cron | NO | Anonymized 3–4 sentence summary of week's discussion → OneSignal push to all members |
| 5 | Auto-Match Room | Haiku, temp=0.2 | NO (on profile update) | Returns `{primary_room_slug, secondary_room_slugs[], reason}` — PPD room never set as primary |
| 6 | Icebreaker | Haiku, temp=0.8 | NO (async after join) | 1-sentence suggested first message shown in input bar — never auto-sent |

**Crisis response flow:** severity high/critical → insert message (mom sees it was received) → insert crisis_flag → resolve real user_id from anon table (service role) → Twilio SMS to moderator → return crisis resources to client in response body.

## V3 — Key Integrations

- **Supabase Realtime:** Live message delivery with server-side filter (flagged msgs never reach client wire)
- **Supabase Presence:** Active member count with hashed user IDs
- **Crisis Hotlines:** `tel:988`, `tel:18009444773` (PSI), `sms:741741?body=HOME` (Crisis Text Line)
- **Calendly:** Webhook `invitee.event_scheduled` → creates `room_events` row → OneSignal push to room members
- **OneSignal Tags:** `room_{id}_notif_all`, `room_{id}_notif_mentions`, `moderators_{id}` — max 1 push per room per 15min

## V3 — Build Sequence (12 weeks / 7 phases)

| Phase | Weeks | Goal |
|---|---|---|
| C1 | 1–2 | DB migration + RLS audit (`user_anonymous_identities` USING FALSE verified), seed 4 rooms + crisis resources, room discovery screen, join/leave |
| C2 | 3–4 | Live chat core: messages API (no AI yet), Supabase Realtime subscription, RoomChatScreen UI, reactions |
| C3 | 5 | Anonymous mode: alias generation, AnonymousOnboardingScreen with legal disclosure, AnonBubble component |
| C4 | 6–7 | AI safety pipeline: Crisis Detection + Content Moderation on write path (Promise.all, 3s timeout), CrisisResourcesSheet, Twilio moderator SMS, ModeratorDashboardScreen |
| C5 | 8–9 | AI companion (@village trigger), icebreaker on join, room auto-match, weekly summary cron |
| C6 | 10 | Expert events (Calendly webhook), ExpertEventScreen, RSVP, OneSignal push notifications |
| C7 | 11–12 | Load test (100 concurrent users), security audit (anon table RLS), crisis drill, moderator runbook, legal review, 50-user beta |

**Critical files:** `003_community_rooms.sql` · `ai/crisisDetectionService.ts` · `services/community/anonymousIdentityService.ts` · `routes/community/messages.routes.ts` (the full write-path orchestrator)

---

---

# VERTICAL 4 — Discover + Home Dashboard
### Events · Brand Perks · Baby Gear Exchange · Milestone Tracker

> Built after V3 is fully live.

---

## V4 — Database Schema

```sql
-- Baby profiles (one per user v1)
CREATE TABLE baby_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  baby_name TEXT, date_of_birth DATE NOT NULL, due_date DATE,
  gender TEXT CHECK (gender IN ('female','male','nonbinary','unknown')),
  birth_weight_grams INTEGER, is_premature BOOLEAN NOT NULL DEFAULT FALSE,
  corrected_age_offset_days INTEGER DEFAULT 0,
  feeding_method TEXT CHECK (feeding_method IN ('breastfed','formula','combo','pumped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Generated column for fast week lookups:
ALTER TABLE baby_profiles ADD COLUMN current_week_number SMALLINT GENERATED ALWAYS AS (
  GREATEST(1, LEAST(104, FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE - date_of_birth)) / 604800) + 1)::SMALLINT)
) STORED;

-- Milestone library (seeded with 52 weeks of content)
CREATE TABLE milestone_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 104),
  category TEXT NOT NULL CHECK (category IN (
    'motor','social','communication','sleep','feeding','sensory','cognitive')),
  title TEXT NOT NULL, description TEXT NOT NULL, hero_emoji TEXT,
  sleep_hours_min NUMERIC(4,1), sleep_hours_max NUMERIC(4,1),
  feed_interval_hours_min NUMERIC(3,1), feed_interval_hours_max NUMERIC(3,1),
  ai_summary_cache TEXT, ai_summary_cached_at TIMESTAMPTZ,
  UNIQUE (week_number, category));

-- User notifications feed
CREATE TABLE user_notifications_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'milestone_alert','event_reminder','deal_expiry','gear_message','daily_checkin','new_match')),
  title TEXT NOT NULL, body TEXT NOT NULL, deeplink TEXT,
  reference_id UUID, reference_table TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE, is_sent BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_for TIMESTAMPTZ, sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- Events (requires PostGIS)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('in_person','online','hybrid')),
  host_name TEXT NOT NULL,
  venue_name TEXT, address_line1 TEXT, city TEXT, state TEXT,
  location GEOGRAPHY(POINT, 4326),     -- PostGIS for geo queries
  zoom_link TEXT, google_meet_link TEXT,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  cost_cents INTEGER NOT NULL DEFAULT 0,  -- 0 = free
  capacity SMALLINT,
  cover_image_url TEXT, emoji TEXT DEFAULT '🌸',
  gradient_from TEXT DEFAULT '#FDEEE8', gradient_to TEXT DEFAULT '#F5C4AA',
  target_week_min SMALLINT, target_week_max SMALLINT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE, is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  ai_summary_cache TEXT, ai_cached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX idx_events_location ON events USING GIST(location);
CREATE INDEX idx_events_starts_at ON events(starts_at) WHERE is_cancelled = FALSE;

CREATE TABLE event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','waitlisted','cancelled')),
  calendar_added BOOLEAN NOT NULL DEFAULT FALSE,
  notif_24h_sent BOOLEAN NOT NULL DEFAULT FALSE, notif_1h_sent BOOLEAN NOT NULL DEFAULT FALSE,
  rsvp_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id));

-- Brand deals (partner perks)
CREATE TABLE brand_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name TEXT NOT NULL, partner_logo_url TEXT, emoji TEXT,
  headline TEXT NOT NULL, description TEXT NOT NULL,
  deal_type TEXT NOT NULL CHECK (deal_type IN ('percent_off','fixed_off','free_item','bogo','first_order')),
  discount_percent NUMERIC(5,2), discount_cents INTEGER,
  promo_code TEXT, deeplink_url TEXT, eligibility TEXT,
  target_week_min SMALLINT, target_week_max SMALLINT,
  target_feeding TEXT[],               -- ['breastfed','pumped']
  max_claims_total INTEGER, max_claims_per_user INTEGER DEFAULT 1,
  active_from TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  affiliate_param TEXT, webhook_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE);
CREATE INDEX idx_brand_deals_active ON brand_deals(is_active, expires_at) WHERE is_active = TRUE;

CREATE TABLE deal_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES brand_deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed','redeemed','expired')),
  utm_click_id TEXT, partner_confirmed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(), redeemed_at TIMESTAMPTZ,
  UNIQUE (deal_id, user_id));     -- enforces max 1 claim per user at DB level

-- Baby gear exchange
CREATE TABLE gear_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'stroller','bassinet','crib','pump','carrier','high_chair','bouncer','monitor','clothing','other')),
  title TEXT NOT NULL, description TEXT NOT NULL, brand TEXT, model TEXT,
  condition TEXT NOT NULL CHECK (condition IN ('like_new','good','fair','for_parts')),
  asking_price_cents INTEGER NOT NULL, is_negotiable BOOLEAN NOT NULL DEFAULT FALSE,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  pickup_city TEXT NOT NULL, pickup_state TEXT NOT NULL,
  pickup_location GEOGRAPHY(POINT, 4326),
  shipping_available BOOLEAN NOT NULL DEFAULT FALSE, shipping_cost_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending_sale','sold','removed')),
  ai_gear_tip TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX idx_gear_listings_location ON gear_listings USING GIST(pickup_location);
CREATE INDEX idx_gear_listings_category ON gear_listings(category, status) WHERE status = 'active';

CREATE TABLE gear_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES gear_listings(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, public_url TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0, is_cover BOOLEAN NOT NULL DEFAULT FALSE);

CREATE TABLE gear_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES gear_listings(id),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  amount_cents INTEGER NOT NULL, platform_fee_cents INTEGER NOT NULL DEFAULT 0,  -- 5%
  stripe_payment_intent_id TEXT UNIQUE, stripe_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','shipped','completed','disputed','refunded','cancelled')),
  buyer_protection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  pickup_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE gear_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES gear_listings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL, is_read BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now());
```

## V4 — Backend API Routes

**Home:** `GET /home/feed` (personalized: baby data + milestone + quick access + event + AI prompt) · `GET /home/milestones/:week` · `POST /home/checkin` · `GET/POST/PATCH /home/baby-profile`

**Events:** `GET /discover/events?lat=&lng=&radius_km=&format=&free_only=&from_date=` · `GET /discover/events/:id` (with AI relevance summary) · `POST /discover/events/:id/rsvp` · `DELETE /discover/events/:id/rsvp` · `GET /discover/events/my-rsvps` · `GET /discover/events/:id/calendar.ics`

**Perks:** `GET /discover/perks` (week + feeding-method filtered + AI ranked) · `GET /discover/perks/:id` · `POST /discover/perks/:id/claim` (builds affiliate-tagged deeplink) · `POST /discover/perks/webhook/redemption` (partner callback) · `GET /discover/perks/my-claims`

**Gear:** `GET /discover/gear?lat=&lng=&radius_km=&category=&condition=&max_price_cents=` · `GET /discover/gear/:id` (with AI gear tip) · `POST /discover/gear` · `POST /discover/gear/:id/photos` · `POST /discover/gear/:id/message` · `POST /discover/gear/:id/purchase` → `{stripe_client_secret}` · `GET /discover/gear/my-listings`

## V4 — Screen Architecture

```
HomeStack:
├── HomeScreen                 (greeting, HeroMilestoneCard, 2x2 QuickAccessGrid,
│                               BabySnapshotCard, UpcomingEventCard, DailyCheckinBanner)
├── MilestoneDetailScreen
├── MilestoneTimelineScreen    (horizontal week selector)
├── BabyProfileSetupScreen     (first-launch: DOB, feeding method, location)
├── DailyCheckinScreen         (mood selector: great|okay|rough|struggling)
└── CheckinResponseScreen      (AI companion reply + specialist CTA if 'struggling')

DiscoverStack:
├── DiscoverHomeScreen         (PerksScrollRow + Events section + GearExchangeHeroCard)
├── Events:
│   ├── EventsListScreen       (geo-filtered, format chips)
│   ├── EventDetailScreen      (AiRelevanceBanner, static map, RSVP button + spot count)
│   ├── WebinarDetailScreen    (Zoom/Meet deeplink launch)
│   ├── RsvpConfirmScreen      (CalendarAddSheet: iOS native | Google | ICS)
│   └── MyRsvpsScreen
├── Perks:
│   ├── PerksListScreen        (AI-recommended shelf + full list)
│   ├── PerkDetailScreen
│   ├── PerkClaimScreen        (shows promo code or affiliate deeplink)
│   └── MyClaimsScreen
└── Gear:
    ├── GearBrowseScreen       (category filter chips + listing cards with distance)
    ├── GearListingDetailScreen (photos carousel, seller badge, AI gear tip, Message/Buy)
    ├── GearSellerProfileScreen
    ├── GearMessageThreadScreen
    ├── CreateListingScreen    (multi-step: Category → Details → Condition/Price → Location → Photos)
    ├── GearCheckoutScreen     (Stripe PaymentSheet, buyer protection disclosure)
    └── MyListingsScreen
```

## V4 — 6 AI Skills

| # | Skill | Trigger | Design |
|---|---|---|---|
| A | Perk Recommender | `GET /discover/perks` | Rank all deals by baby_week + feeding_method → top 3 = "AI Recommended" shelf |
| B | Event Relevance | `GET /discover/events/:id` (cached on event row) | 2-sentence "why this event is for you" based on baby week + feeding method |
| C | Gear Tip | `GET /discover/gear/:id` | 1-sentence (max 20 words) connecting gear item to baby's current week |
| D | Daily Check-in Companion | `POST /home/checkin` | 3–5 sentences: acknowledge → micro-tip → encouragement. If 'struggling' → always append specialist CTA |
| E | Milestone Explainer | Weekly cron (Sunday midnight) | 60–90 word paragraph per week, covering motor + social + sleep + what mom can do. Stored in `milestone_library.ai_summary_cache` |
| F | Home Feed Curator | `GET /home/feed` | Reorders QuickAccessGrid + picks most relevant upcoming event. Returns JSON only |

**All V4 AI calls use `cache_control: { type: "ephemeral" }` on system prompt blocks for prompt caching.**

## V4 — Key Integrations

- **PostGIS:** `ST_DWithin` for event + gear geo queries (more accurate than earthdistance at Miami's latitude)
- **Google Maps:** Static map thumbnail on EventDetailScreen, directions deeplink (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`), Places autocomplete on CreateListingScreen address field (server-proxied to avoid key exposure)
- **Zoom/Google Meet:** `Linking.openURL()` with `zoommtg://` deeplink → browser URL fallback
- **Stripe Connect:** Gear exchange with 5% platform fee, 48h buyer protection hold on payout after `pickup_confirmed_at`
- **Calendar:** `expo-calendar` for iOS/Android native + Google Calendar URL + ICS file download via `Share.share()`
- **OneSignal (6 notification types):** Daily check-in (9am local), milestone week advance (Sunday midnight), event reminders (24h + 1h before RSVP), deal expiry (24h warning), gear message received (real-time), waitlist spot opened (real-time)
- **Affiliate tracking:** UTM deeplinks built server-side; partner redemption webhook with `X-Partner-Secret` validation updates `deal_claims.status='redeemed'`

## V4 — Build Sequence (12 weeks / 6 phases)

| Phase | Weeks | Goal |
|---|---|---|
| D1 | 1–2 | `baby_profiles` + `milestone_library` migrations, seed 52 weeks of content, BabyProfileSetupScreen, MilestoneDetailScreen, basic `GET /home/feed` (no AI yet) |
| D2 | 3–4 | Events tables (PostGIS), events API with geo-filter, EventsListScreen + EventDetailScreen + RSVP |
| D3 | 5–6 | Brand perks tables + API, perk claim with affiliate UTM, PerksListScreen + PerkClaimScreen; gear tables + browse/create listing screens |
| D4 | 7–8 | Full HomeScreen with all 6 component blocks; DiscoverHomeScreen tying all 3 sections; gear messaging + Stripe checkout |
| D5 | 9–10 | All 6 AI skills integrated; OneSignal setup with all 6 notification types; calendar integration; cron jobs (milestone explainer, notification scheduler, deal expiry alerts) |
| D6 | 11–12 | Waitlist auto-promotion, MyRsvps/MyClaims/MyListings screens, buyer protection flow, analytics instrumentation, app store update with Discover tab screenshots |

**Critical files:** `007_events.sql` (PostGIS column unblocks all geo queries) · `home/home.service.ts` (orchestrates feed assembly) · `ai/skills/dailyCheckinCompanion.ts` (most user-facing AI, PPD safety guardrails) · `screens/discover/DiscoverHomeScreen.tsx`

---

---

## Global File Structure

```
village-app/
├── apps/
│   ├── mobile/src/
│   │   ├── screens/
│   │   │   ├── auth/           (Splash, Onboarding, SignUp, Login, ForgotPassword, OnboardingProfile)
│   │   │   ├── search/         (V1: SearchHome, Filter, ResultsList, ResultsMap, SpecialistProfile,
│   │   │   │                        Booking, Payment, BookingConfirm, ReviewSubmit, Messaging)
│   │   │   ├── milk/           (V2: MilkConnectHome, DonorMap, DonorSearch, DonorProfile,
│   │   │   │                        SavedDonors, DonorDashboard, DonorListings, DonorOrders,
│   │   │   │                        BecomeDonorIntro, DonorQuestionnaire, TrustBadgeBuilder,
│   │   │   │                        CreateListing, StripeOnboarding, MessageThreads, MessageDetail)
│   │   │   ├── community/      (V3: CommunityHome, RoomChat, RoomInfo, AnonymousOnboarding,
│   │   │   │                        ExpertEvent, ModeratorDashboard, CrisisFlagDetail, RoomSearch)
│   │   │   ├── home/           (V4: Home, MilestoneDetail, MilestoneTimeline,
│   │   │   │                        BabyProfileSetup, DailyCheckin, CheckinResponse)
│   │   │   └── discover/       (V4: DiscoverHome, EventsList, EventDetail, WebinarDetail,
│   │   │                            RsvpConfirm, MyRsvps, PerksList, PerkDetail, PerkClaim,
│   │   │                            MyClaims, GearBrowse, GearListingDetail, GearSellerProfile,
│   │   │                            GearMessageThread, CreateListing, GearCheckout, MyListings)
│   │   ├── components/         (shared + per-vertical component folders)
│   │   ├── navigation/         (RootNavigator, AuthStack, AppNavigator + all stack navigators)
│   │   ├── store/              (Zustand: auth, user, search, favorites, ai, milk, community, discover)
│   │   ├── hooks/              (per-vertical hook files)
│   │   ├── api/                (per-resource API fetch wrappers)
│   │   ├── utils/              (distance, formatters, validators, crisisDeeplinks, constants)
│   │   ├── types/              (per-vertical TypeScript interfaces)
│   │   └── i18n/               (en.json, es.json, ht.json)
│   │
│   └── backend/src/
│       ├── config/             (supabase, stripe, twilio, anthropic, env validation)
│       ├── middleware/         (auth JWT, rateLimiter, requireModerator, errorHandler)
│       ├── routes/             (auth, users, specialists, reviews, appointments, booking,
│       │                        payments, ai, npi, admin, milk/*, community/*, home, discover/*,
│       │                        webhooks/*)
│       ├── services/
│       │   ├── ai/             (V1: match, profileQA, translate, reviewSummary, reminder,
│       │   │   │                    followup, triage)
│       │   │   ├── milk/       (safetyScreener, donorMatcher, donorQA, trustNarrative, questionnaireCoach)
│       │   │   ├── community/  (crisisDetection, contentModeration, aiCompanion,
│       │   │   │                roomSummary, roomMatch, icebreaker)
│       │   │   └── discover/   (perkRecommender, eventRelevance, gearTip,
│       │   │                    dailyCheckin, milestoneExplainer, homeFeedCurator)
│       │   └── (geocoding, calendly, zocdoc, stripe, twilio, npi, shippo)
│       └── jobs/               (appointmentReminder, reviewSummaryRefresh, weeklySummary,
│                                presenceCleanup, milestoneExplainer, notificationScheduler,
│                                dealExpiryAlerts)
│
├── supabase/migrations/
│   ├── 001_v1_initial_schema.sql
│   ├── 002_v1_rls_policies.sql
│   ├── 003_v1_seed_data.sql
│   ├── 004_v2_milk_connect.sql
│   ├── 005_v2_milk_rls.sql
│   ├── 006_v3_community_rooms.sql
│   ├── 007_v3_community_rls.sql       ← includes USING(FALSE) on anon_identities
│   ├── 008_v4_baby_profiles.sql
│   ├── 009_v4_milestone_library.sql
│   ├── 010_v4_events.sql              ← requires PostGIS
│   ├── 011_v4_brand_deals.sql
│   └── 012_v4_gear.sql
│
└── packages/shared/src/types/         (TypeScript interfaces shared by mobile + backend)
```

---

## Environment Variables (all verticals)

```
# Supabase
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, SUPABASE_ANON_KEY

# AI
ANTHROPIC_API_KEY

# Maps
GOOGLE_MAPS_API_KEY, GOOGLE_GEOCODING_API_KEY, GOOGLE_PLACES_API_KEY

# Payments
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY

# SMS
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

# Booking
CALENDLY_CLIENT_ID, CALENDLY_CLIENT_SECRET, CALENDLY_WEBHOOK_SECRET
ZOCDOC_API_KEY  (v2 — requires partnership)

# Notifications
ONESIGNAL_APP_ID, ONESIGNAL_API_KEY

# NPI
NPI_REGISTRY_BASE_URL=https://npiregistry.cms.hhs.gov/api

# Mobile (EXPO_PUBLIC_ prefix)
EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
EXPO_PUBLIC_ONESIGNAL_APP_ID
```

---

## Key Cross-Vertical Decisions

| Decision | Rationale |
|---|---|
| Calendly before Zocdoc | Calendly is self-service OAuth. Zocdoc requires a business partnership agreement. |
| `earthdistance` for V1/V2, PostGIS for V3/V4 | PostGIS is on the Pro plan and needed by V4 anyway. V1/V2 use simpler earthdistance. |
| Translation cached by content_hash | Same bio text only translated once per language — ~90% cost reduction at scale. |
| Crisis scan synchronous on write path | A crisis message that reaches the room even for 2 seconds is unacceptable in a PPD support space. |
| Anonymous aliases server-only | Client never holds the user_id → alias mapping. Anonymity holds even if app is reverse-engineered. |
| Haiku for real-time scans, cache system prompts | Haiku latency + cost is acceptable for per-message scans. Prompt caching cuts costs ~80% on repeated calls. |
| Polling messages in V1 (30s), Realtime in V3 | V1 messages are async/low-frequency contact forms. V3 is live chat — realtime is required. |
| 15% fee on Milk Connect, 5% on Gear Exchange | Milk Connect is higher-margin peer-to-peer healthcare product. Gear Exchange competes with Facebook Marketplace. |
| Buyer protection 48h hold on Gear payouts | Holds seller payout until `pickup_confirmed_at` + 48h. Reduces fraud without requiring escrow. |
