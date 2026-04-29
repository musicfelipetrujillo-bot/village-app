# App Store Submission — The Village

Reference doc for App Store Connect + Google Play Console listings. All copy
below is drafted for the **hospital-discharge GTM** positioning (clinician
hands phone to postpartum mom — copy must be calm, clinical-handoff-grade,
never breezy/marketing).

---

## 1) iOS — App Store Connect

### App information

| Field | Value |
|---|---|
| **App Name** | The Village |
| **Subtitle** (30 char max) | Postpartum care, in one place |
| **Primary Category** | Health & Fitness |
| **Secondary Category** | Medical |
| **Bundle ID** | `com.thevillage.app` |
| **SKU** | `village-mobile-001` |

### Promotional Text (170 char — editable without resubmission)

> Your postpartum support team in one app. Find OB/GYNs, doulas, lactation
> consultants, and pediatricians near you. Track milestones. Connect with
> other moms.

### Description (4000 char max)

```
The Village is a postpartum support app for new and expecting moms.

Built with maternal-health clinicians, The Village helps you find the right
care, track your baby's first year, and connect with other moms — all in one
place.

WHAT YOU CAN DO

— Find specialists near you
Search OB/GYNs, doulas, midwives, lactation consultants, pediatricians, sleep
coaches, pelvic floor PTs, perinatal dietitians, and PPD therapists.
Filter by insurance, distance, and language. Read verified reviews. Book
appointments directly through your provider's calendar.

— Track your baby's milestones
Week-by-week milestone tracking from week 1 through week 52, written by
pediatric specialists. Tailored to your baby's age, feeding method, and
whether they were born preterm.

— Daily check-ins
Quick daily mood and energy check-ins with a warm, judgment-free response.
Crisis resources surfaced automatically when needed — including 988
(Suicide & Crisis Lifeline), Postpartum Support International, and the
Crisis Text Line.

— Milk Connect (peer milk-sharing marketplace)
For moms who can't or choose not to formula-feed. Browse verified local
donors with safety screening, allergy info, and dietary disclosures.
Optional Stripe-backed payment. Always check with your pediatrician before
using donor milk.

— Community rooms
Moderated chat rooms organized by stage (TTC, trimester 1/2/3, postpartum
weeks 0–6, 6–24, 6m+). AI-assisted moderation flags safety concerns. Crisis
resources always one tap away.

— Curated gear marketplace
Buy and sell baby gear locally. Every listing checked against the
CPSC recall database before it goes live. Built-in safe-meeting checklist.
Cash and peer-to-peer payments only — The Village does not process gear
payments.

— Events & perks
Local meetups, expert webinars, and curated brand discounts matched to
your stage.

WHO IT'S FOR

The Village is built for moms in the U.S. Most useful in the first 0–6
weeks postpartum, but supports the full journey from trying-to-conceive
through baby's first year.

NOT MEDICAL ADVICE

The Village is a directory and tracking tool, not a medical service. AI
features are decision support, not diagnosis. Always consult your
provider for medical decisions. In an emergency call 911. For mental
health crises call or text 988.

PRIVACY

We never sell your data. Your baby's name and birthday are stored
encrypted at rest. You can delete your account from Settings at any time.
Read our privacy policy at thevillageapp.com/privacy.html.
```

### Keywords (100 char max, comma-separated)

```
postpartum,doula,lactation,pediatrician,obgyn,milestone,baby tracker,mom,milk donor,maternal health
```

### Support / Marketing URLs

| Field | URL |
|---|---|
| **Marketing URL** | `https://village-website-musicfelipetrujillo-bots-projects.vercel.app/` |
| **Support URL** | `https://village-website-musicfelipetrujillo-bots-projects.vercel.app/contact.html` |
| **Privacy Policy URL** | `https://village-website-musicfelipetrujillo-bots-projects.vercel.app/privacy.html` |
| **Copyright** | `© 2026 The Village` |

### Age Rating

**Recommended: 17+** because of:
- **Unrestricted Web Access** — None (no in-app web browsing)
- **Medical/Treatment Information** — Frequent (specialist info, milestones, mental health)
- **Mature/Suggestive Themes** — Infrequent (postpartum / breastfeeding / fertility content)
- **Profanity or Crude Humor** — None expected, but moderated chat rooms could surface user content

If you go 12+, expect Apple to push back and require 17+ on review.

### Review notes (private — for Apple reviewer only)

```
Reviewer login (already provisioned):
Email: review-apple@thevillageapp.com
Password: [TO BE PROVIDED — create a real test account before submission]

To exercise the full app:
1. Sign up with the credentials above (or any email)
2. On the onboarding screen, select stage "Postpartum 0–6 wk"
3. Enter ZIP 33133 (Miami) for nearby specialists, donors, gear
4. The Connect tab is intentionally hidden in this build — V3 Community
   ships in a later release pending moderation infrastructure

Permissions are all optional and used only as described in their usage
strings. Location is used to surface nearby specialists/donors/events;
the app works without it via ZIP fallback.

The Milk Connect marketplace is peer-to-peer milk donation between moms.
There is no commercial milk sale; donations are intended for personal use
and explicitly disclaimed as not-medical-advice. Pediatrician consultation
is recommended before use, and this is surfaced in-app.

The Gear Marketplace is local-pickup only. The Village does not process
payments — buyers pay sellers directly via cash or peer-to-peer apps.
Every listing is checked against the CPSC recall database; recalled
items are blocked at listing time.

AI features (Villie chat, milestone explainers, weekly summaries) all
display "not medical advice" disclaimers and route to crisis resources
(988, Postpartum Support International, Crisis Text Line) when crisis
language is detected.

For any review questions, reach out to review-apple@thevillageapp.com.
```

### Sign in info (App Store Connect requires test credentials)

```
Username: review-apple@thevillageapp.com
Password: [CREATE BEFORE SUBMIT]
```

---

## 2) App Privacy declaration (App Store Connect → App Privacy)

This is the most-failed gate at submission. Map every data type collected in
the app to Apple's taxonomy, then declare per-type whether it's:
- **Used to track you** (data linked across companies for advertising)
- **Linked to you** (associated with the user identity)
- **Not linked to you** (anonymized)

### Data types collected by The Village

| Data type | Apple bucket | Purpose | Linked? | Used to track? |
|---|---|---|---|---|
| Email address | Contact Info | App Functionality, Account Management | Linked | No |
| Name | Contact Info | App Functionality | Linked | No |
| Phone number (optional) | Contact Info | App Functionality (SMS appointment reminders) | Linked | No |
| Physical address (ZIP code) | Contact Info | App Functionality (nearby specialists, donors) | Linked | No |
| User ID (Supabase auth UUID) | Identifiers | App Functionality | Linked | No |
| Device ID (OneSignal external_id) | Identifiers | App Functionality (push notifications) | Linked | No |
| Coarse location (when granted) | Location | App Functionality (nearby specialists/events) | Linked | No |
| Photos (avatar, gear listings) | User Content | App Functionality (profile, marketplace listings) | Linked | No |
| Audio data | — | **NOT collected** (mic permission declared but unused for audio capture) | — | — |
| Health data (pregnancy stage, due date, baby DOB, feeding method, mood/energy check-ins, milestone progress) | Health & Fitness | App Functionality (personalized milestone tracking, daily check-ins) | Linked | No |
| Diagnostics / crash data (Sentry) | Diagnostics | App Functionality (crash reporting) | Linked | No |
| Product interaction (analytics events — gear views, milk views, perk claims) | Usage Data | Analytics, Product Personalization | Linked | No |

**Critical: "Used to track" must be NO for everything.** The Village does not
share any data with third-party advertisers. Crash reports go to Sentry but
are PII-stripped via `beforeSend` (per CLAUDE.md).

### Third-party SDKs that touch user data

| SDK | What it sees | Mitigation |
|---|---|---|
| Supabase | All user data (RLS-gated) | Supabase is the canonical backend — same data, same legal entity |
| OneSignal | Push tokens + tags (`pregnancy_stage`, `preferred_language`, prefs) | External_id only — no email/PII |
| Stripe | Payment-related data (Milk Connect only) | Stripe handles PCI scope; The Village never sees card numbers |
| Twilio | Phone number + SMS body | Used for appointment reminders + crisis moderator alerts only |
| Sentry | Crash stack traces, user.id only | `beforeSend` hook strips email/username server-side |
| Anthropic (Claude API) | Message bodies sent to AI features | Cleared message bodies only; never PII like names/emails |
| Google Maps | Coarse location | Map tile rendering; no user identity sent |

### Privacy Manifest (`PrivacyInfo.xcprivacy`)

Required for iOS 17+ apps. Expo SDK ≥50 auto-generates one based on plugins.
**Confirm before submit:** Expo build output includes
`PrivacyInfo.xcprivacy` in the IPA. If missing, declare these required-reason
APIs:

| API category | Reason code |
|---|---|
| File timestamps (NSPrivacyAccessedAPICategoryFileTimestamp) | `C617.1` (display to user) |
| System boot time (NSPrivacyAccessedAPICategorySystemBootTime) | `35F9.1` (calculate elapsed time) |
| Disk space (NSPrivacyAccessedAPICategoryDiskSpace) | `E174.1` (write to file system after free-space check) |
| User defaults (NSPrivacyAccessedAPICategoryUserDefaults) | `CA92.1` (storing settings within the app) |

These are typical for an Expo + RN app. Do **not** declare advertising
categories.

---

## 3) Android — Google Play Console

Mirror the iOS copy. Differences:

| Field | Value |
|---|---|
| **Short description** (80 char) | Postpartum care, milestone tracking, and mom community in one app. |
| **Full description** | Same as iOS Description above |
| **Application type** | App |
| **Category** | Health & Fitness |
| **Tags** | Health, Parenting, Pregnancy, Maternal Health |
| **Content rating** | Everyone (will reroll on questionnaire — likely Teen due to community chat) |
| **Target audience** | Adults (18+) — required because of milk donation and mental health features |
| **Data safety form** | Same data types as iOS App Privacy above |

### Google Play Data Safety form

Mirrors App Privacy. Same answer set: linked-yes, tracked-no, encrypted-in-
transit-yes, deletion-on-request-yes (account-delete edge function still
pending per A2.c).

---

## 4) Screenshots — required dimensions

App Store Connect (one set required, take from a real device or simulator):

| Device class | Dimensions | Count required |
|---|---|---|
| iPhone 6.7" (iPhone 16 Pro Max, 15 Pro Max) | 1290 × 2796 | 3–10 |
| iPhone 6.5" (iPhone 11 Pro Max) | 1242 × 2688 | 3–10 (legacy — only if 6.7" missing) |
| iPhone 5.5" (iPhone 8 Plus) | 1242 × 2208 | 3–10 |
| iPad 13" (iPad Pro 12.9" gen 6) | 2048 × 2732 | only if `supportsTablet: true` (currently FALSE) |

**You currently have `ios.supportsTablet: false`**, so iPad screenshots are
not required. Drop the 5.5" set if Apple lets you (they will, since iPhone 8
Plus is deprecated — submit only 6.7" and 6.5" minimum).

### Recommended screenshot order

1. **Home — milestone hero card** (Week 4: "Your baby is tracking sounds")
2. **Specialists list** with nearby pins
3. **Daily check-in flow** (mood + warm AI reply)
4. **Milk Connect donor profile** (verified badges, trust narrative)
5. **Gear listing detail** with CPSC-checked badge
6. **Community rooms** [SKIP if Connect tab hidden in this build]
7. **Me / profile** (preferences, notifications, search radius)

---

## 5) What only YOU can provide

| # | Item | Where to get it |
|---|---|---|
| 1 | **Apple Developer Account** | developer.apple.com — $99/year |
| 2 | **Apple ID for `eas.json`** | The email on your Apple Developer account |
| 3 | **App Store Connect App ID (`ascAppId`)** | App Store Connect → your app → App Information → "Apple ID" (number) |
| 4 | **Apple Team ID (`appleTeamId`)** | developer.apple.com → Membership → Team ID |
| 5 | **Google Play Developer Account** | play.google.com/console — $25 one-time |
| 6 | **Google Play service account JSON** | Play Console → Setup → API access — download key, place at `google-play-key.json` |
| 7 | **Reviewer test account** | Sign up `review-apple@thevillageapp.com` in the actual app and provide password in review notes |
| 8 | **Screenshots** | Capture from device or simulator (see §4) |
| 9 | **Privacy policy host** at a stable URL | We currently use the Vercel autogenerated URL. Apple reviewers sometimes flag long random subdomains as "not your domain". Consider buying `thevillageapp.com` before submit. |

---

## 6) Pre-submit checklist

Run through this in order. Each box must be true before pressing Submit.

- [ ] Hosted Supabase URL + anon key wired in `eas.json` production env (DONE 2026-04-27)
- [ ] OneSignal plugin set to `mode: production` (DONE 2026-04-27)
- [ ] `eas.json` submit block has real Apple ID + ASC App ID + Team ID (BLOCKED on you)
- [ ] Reviewer test account created and signed up in production
- [ ] Crisis resource phone numbers verified word-for-word with source orgs (988, PSI, Crisis Text Line)
- [ ] All `not medical advice` disclaimers present on AI features
- [ ] Connect tab hidden in production build (verify `AppNavigator.tsx`)
- [ ] Account-delete flow shipped or "request deletion" path documented (Privacy form requires it)
- [ ] Run `eas build --profile production --platform ios` and confirm IPA opens against hosted Supabase
- [ ] Run `eas submit --platform ios` and walk through TestFlight first
- [ ] Internal TestFlight test with 3+ users for 48hrs before public-store submit
