# App Store Submission — villie

Reference doc for App Store Connect listing. All copy below is drafted for the **hospital-discharge GTM** positioning (clinician hands phone to postpartum mom — copy reads calm, clinical-handoff-grade, never breezy/marketing).

**App Store ID**: 6773357128
**Bundle ID**: `com.villieapp.mobile`
**Brand canonical**: `villie` lowercase, never "The Village" or "Villie"
**Last refreshed**: 2026-05-28

---

## 1) App Information (rarely changes)

| Field | Value |
|---|---|
| **App Name** | villie |
| **Subtitle** (30 char max) | A village for every mom |
| **Primary Category** | Health & Fitness |
| **Secondary Category** | Medical |
| **Bundle ID** | `com.villieapp.mobile` |
| **SKU** | `villie-mobile-001` |
| **Copyright** | `© 2026 villie` |

> Subtitle is **23 chars** — fits Apple's 30-char ceiling with room. Tagline pulls from the in-app footer ("villie · a village for every mom") so the App Store label, splash, footer, and newsletter all rhyme.

---

## 2) Promotional Text (170 char — editable without resubmission)

```
Postpartum support, hand-delivered. Find specialists, track baby's first year, peer milk-sharing, and a 24-hour line that knows your stage. Cash-only marketplace.
```

> 165 chars. Edit any time without a new build. Use the freedom: rotate this when launching a hospital pilot ("Now bundled with discharge at [hospital]"), or after a press hit.

---

## 3) Description (4000 char max)

```
villie is the postpartum support app new moms use when they leave the hospital.

Built with maternal-health clinicians for the first six weeks home, villie pulls every line of support a mom needs into one quiet place — a directory of specialists, a week-by-week Manual for baby's first year, a daily check-in that listens, peer milk-sharing for moms who can't or don't formula-feed, a moderated marketplace for outgrown gear, and a 24-hour crisis line one tap from any screen.

WHAT'S INSIDE

— Specialists near you
OB/GYNs, doulas, midwives, lactation consultants, pediatricians, sleep coaches, pelvic floor PTs, perinatal dietitians, and PPD therapists. Filter by insurance, distance, and language (English / Spanish). Booking goes through Stripe with Apple Pay.

— The Manual
A week-by-week chapter library from week 1 through week 52, structured as Sleep / Feed / Grow / Care / Wins for baby and Feel / Heal / Nourish / Rest / Tips for mom. Every chapter is a video plus a short article plus a printable checklist plus an illustration — written by pediatric and postpartum specialists, tuned to your baby's age and feeding method.

— Daily check-in
One tap to record how you're doing. villie reads it, replies in your voice, and surfaces crisis resources when the language flags concern. Mood and energy roll up into a private week timeline you can share with your provider.

— Milk Connect
Peer-to-peer breast milk sharing for moms who can't or don't formula-feed. Browse local donors with allergy disclosures, dietary screening, and verified-mom badges. Cash or peer-to-peer payment on pickup. Safe-handoff walkthrough required before the first message. Always check with your pediatrician.

— Gear marketplace
Buy and sell baby gear locally. Every listing is checked against the CPSC recall database before it goes live, and recalled items are blocked at upload. Built-in safe-meeting checklist. Cash and peer-to-peer payments only — villie does not process gear payments.

— Events and brand perks
Local meetups, expert webinars, and curated discounts from postpartum brands like Comotomo, UPPAbaby, Bobbie, and Nesting Co.

— 24-hour crisis access
988, Postpartum Support International (1-800-944-4773), Crisis Text Line (text HOME to 741741), and Miami-Dade local crisis lines available from any screen — including auto-surfaced on the check-in when language flags risk.

WHO IT'S FOR

Moms in the United States. Most useful in the first 0 to 6 weeks home from the hospital. Supports the full journey from trying-to-conceive through baby's first year. Fully translated to Spanish — clinical disclaimers and crisis lines included.

NOT MEDICAL ADVICE

villie is a directory, a tracker, and a quiet companion. It is not a medical service. AI features are decision support, not diagnosis. Always consult your provider for medical decisions. In an emergency call 911. For mental health crises call or text 988.

PRIVACY

We never sell your data and don't run ads. Your health information is encrypted in transit and at rest. Account deletion ships from Settings. Read the full policy at villieapp.com/privacy.
```

> 3,012 chars. Leaves 988 chars of headroom for future expansion (e.g. add a "WHAT'S NEW IN 1.1" block on next bump).

---

## 4) Keywords (100 char max, comma-separated, NO SPACES after commas)

```
postpartum,doula,lactation,pediatrician,obgyn,milestone,baby tracker,milk donor,maternal health,mom
```

> 99 chars. Includes the highest-intent ASO terms for a postpartum app. Avoid the keyword "village" (low-intent, drowns under unrelated apps). "mom" picks up the broad parenting traffic without the algorithm penalizing for "mother" duplication.

---

## 5) What's New in this version

### Build 11 (1.0.0)

```
First release. The full postpartum stack — specialists, week-by-week Manual, daily check-in, peer milk-sharing, gear marketplace, brand perks, and 24-hour crisis access — all in one app. English and Spanish.
```

> 220 chars. For subsequent builds, write 1-2 sentences and lead with the user-visible change ("Added PDF export for Manual chapters" beats "Various improvements and bug fixes").

---

## 6) Support / Marketing URLs

| Field | URL | Status |
|---|---|---|
| **Marketing URL** | `https://villieapp.com` | Must be live before submit |
| **Support URL** | `https://villieapp.com/support` | Must be live before submit |
| **Privacy Policy URL** | `https://villieapp.com/privacy` | **BLOCKING** — Apple rejects without it |

---

## 7) Age Rating

**Target: 17+** due to:

- **Medical / Treatment Information** — Frequent (specialist directory, milestone tracking, mental-health check-ins)
- **Mature / Suggestive Themes** — Infrequent (postpartum recovery / breastfeeding / fertility content)
- **Unrestricted Web Access** — None (in-app browsing is disabled)
- **User-Generated Content** — Yes, but moderated (Connect tab hidden in current build; Gear listings reviewed by mod cron + 24h SLA)
- **Profanity** — None expected

> If you select 12+ Apple will likely reroll to 17+ during review based on the postpartum / mental-health surfaces. Pick 17+ upfront to skip the back-and-forth.

---

## 8) Review Notes (private — Apple reviewer only)

```
Test account (pre-provisioned):
  Email: review-apple@villieapp.com
  Password: [SET BEFORE SUBMIT — minimum 12 chars, no SSO]

To exercise the full app:

1. Sign up with the credentials above, or with any email.
2. On onboarding, select stage "Postpartum 0–6 months" and ZIP 33133 (Miami)
   to populate nearby specialists, milk donors, and gear listings.
3. The Connect (community chat) tab is intentionally hidden in this build —
   moderation infrastructure ships with a later release.
4. The Manual reaches every chapter — try Week 1 Sleep, then the daily
   check-in.
5. Crisis resources are available from any screen via the "Need help now?"
   row on the home feed, and auto-surface on the daily check-in when the
   AI flags risk language.

Permissions are all optional and used only as described in their usage
strings. Location is used to surface nearby specialists / donors / gear
listings; the app works without it via ZIP fallback (Miami in this seed).

Milk Connect is peer-to-peer breast milk sharing. There is no commercial
milk sale through villie — payments are cash or P2P, off-platform. The
SafeMilkHandoff walkthrough is required before the first message to a
donor. A "not medical advice" disclaimer and a pediatrician-consultation
reminder are surfaced before every contact.

The Gear marketplace is local pickup, cash-only. villie does not process
payments for gear. Every listing is checked against the CPSC recall
database at upload; recalled items are hard-blocked. Listings flagged
for harassment or recall are auto-withdrawn within 24h by a moderation
cron (see docs/V4_GEAR_TAKEDOWN_SOP.md).

AI features (the daily check-in reply, milestone explainers, weekly
summaries) all display "not medical advice" disclaimers and route to
crisis resources (988, Postpartum Support International, Crisis Text
Line, 911) when crisis language is detected by the moderation pass.

For any review questions, reach review at:
  reviews@villieapp.com
```

---

## 9) Cross-references

- **App Privacy questionnaire**: see `docs/APP_PRIVACY_QUESTIONNAIRE.md` — paste-ready answers for every data category and the linked × tracking × purpose matrix.
- **Screenshot capture plan**: see `docs/SCREENSHOT_PLAN.md` — the 8-screen sequence, the per-screen overlay copy, and the simulator capture recipe.
- **Spanish discharge-surface audit**: see `docs/I18N_DISCHARGE_AUDIT.md` — confirms ES copy is clinician-grade, lists the 4 polish nits.
- **TestFlight + build train**: see `docs/TESTFLIGHT_STATE.md` — current Apple Beta Review state and the Build 12 queue.

---

## 10) Pre-submit checklist

Each box must be true before pressing **Submit for Review** on the public store.

- [ ] `villieapp.com/privacy` returns 200 with the published policy
- [ ] `villieapp.com/support` returns 200 with a contact path
- [ ] App Privacy form filled per `docs/APP_PRIVACY_QUESTIONNAIRE.md`, labels published
- [ ] All 8 screenshots uploaded for 6.7" + 6.5" device classes
- [ ] Reviewer test account created in production with a real Postpartum 0–6 stage selection
- [ ] Crisis-line numbers verified word-for-word against source orgs (988, PSI 1-800-944-4773, Crisis Text Line 741741, Miami-Dade 305-358-4357)
- [ ] All "not medical advice" disclaimers present on AI surfaces (DailyCheckin reply, Manual chapters, Weekly Journey, Milk Hub, Gear marketplace)
- [ ] Connect tab confirmed hidden in production build (`AppNavigator.tsx`)
- [ ] Account-delete flow surfaces from Settings → Account
- [ ] Stale Info.plist permissions removed for Build 12+ (`NSContactsUsageDescription`, `NSMicrophoneUsageDescription`, `NSLocationAlwaysUsageDescription`) — see `APP_PRIVACY_QUESTIONNAIRE.md` Step 5
- [ ] Build 11 has been installed on at least 1 external tester device and the OTA channel is confirmed working
- [ ] `eas submit --platform ios` walked through TestFlight first
- [ ] 48-hour external TestFlight period with at least 3 testers signed off

---

## 11) Maintenance triggers

Edit this doc when:
- Apple revises the listing form or character limits
- A new vertical ships (e.g. partner-pilot mode, in-app classes)
- The What's New for the next version is decided
- Crisis-line numbers are added or rotated
