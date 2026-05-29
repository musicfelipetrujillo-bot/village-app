# V5 — "A manual that grows with you"

Captured from Felipe's voice memo 2026-05-29. Source: `New Recording 7.m4a`, ~4:47.

## Theme

The Manual is currently a static 52-week reference. V5 turns it into a **personalized playbook** that adapts to the user's daily check-in answers and stated preferences (co-sleeping vs. sleep training, starting solids, etc.). The shift is from "the same book for every mom" to "a book that knows your baby."

This is also the natural moment to introduce a **subscription tier** — generic manual stays accessible, personalized playbook + mom hacks gate behind Pro.

---

## Ask 1 — Home: add a "Mom" hero

New surface on the Home screen (or as a new tab — see open question) dedicated to mom-side content:
- Daily mom advice
- Mom hacks
- Mom articles for the postpartum window

This is the surface that absorbs everything that used to live in the now-removed Mom Manual.

## Ask 2 — Manual restructure

| Before | After |
|---|---|
| `Mom × {Feel, Heal, Nourish, Rest, Tips}` | **Removed.** Optional restore in Phase 2. |
| `Baby × {Feed, Sleep, Grow, Care, Wins}` | **Renamed**: "General Manual" (the static educational base) |
| — | **New: "Playbook"** — personalized, adapts to user preferences + check-in data |

The General Manual stays as the encyclopedic reference. The Playbook is the thing that "grows with you."

### Playbook personalization inputs

Two pain points are the spine:
- **Sleep** — co-sleeping vs. sleep training preference
- **Feed** — breastmilk / formula / mixed; starting-solids stage

Preferences are mutable from a settings surface; Playbook regenerates on preference change so the user can experiment without losing their place.

## Ask 3 — Daily check-in becomes "Baby's check-in"

Today: 5-mood slider + free text about how *mom* is doing.
V5: 2 categories — **Sleep** + **Feed** — about how *baby* did.

For each, a quick icon-picker OR short text input:
- "How did baby sleep last night?" — duration / wake-up count / time frame
- "How is feeding going?" — frequency / volume / cluster

The check-in feeds a **personalized schedule generator** that recommends:
- Nap schedule for today, given last night's wakings
- Feed cadence, given the last cluster
- Adjustments as preferences change

Felipe's example phrasing: *"My baby woke up 4 times overnight — what should naps look like today?"*

## Ask 4 — Subscription tier

| Tier | What's in it |
|---|---|
| **Free / Generic** (or low-cost) | General Manual access (the static 52-week base) |
| **Pro** | Personalized Playbook · Mom hacks + tips library · Personalized schedule recommendations · Check-in history view |

Mom hacks are framed as "tried-and-proven by moms across social platforms" — explicitly NOT science-backed, framed as wisdom-of-the-village content. Distinct from the clinically-sourced General Manual.

---

## Open questions for Felipe

These need answers before scoping the spec:

1. **Mom hero placement** — new bottom tab (replacing one of the existing 6), or a new card on the Home feed?
2. **Pricing** — is the General Manual genuinely free, or behind a small monthly fee? If free: what's the Pro price?
3. **Schedule generator engine** — AI (Claude API per nap recommendation, ~$0.001/call) or rule-based heuristics (no per-call cost, more predictable)?
4. **Mom hacks content** — curated by you (slow + on-brand), submitted by moms via Connect tab (community + moderation overhead), or scraped from social (legal risk)?
5. **Pro paywall timing** — paywall on first Playbook view, or after a free-trial week?
6. **Pre-Pro upgrade prompts** — show "Upgrade" CTAs throughout the app, or keep them quiet and tap-discoverable?

---

## Suggested sequencing

Three phases. Don't try to ship all of V5 at once.

### Phase 5.1 — UI shell + Manual rename (OTA, 1 day)

Pure JS rename + nav reshuffle. No backend, no subscription. Lets us A/B the new mental model without committing to anything irreversible.

- Mom tab/hero scaffold on Home
- Remove Mom Manual from Manual tab (or hide behind a feature flag for rollback)
- Rename Baby Manual → "General Manual"
- Add empty "Playbook" tab in Manual that shows a teaser: *"Coming soon — your personalized weekly playbook."*
- Update copy throughout (i18n EN+ES per discharge-grade bar)

### Phase 5.2 — Baby's check-in + personalized schedule (Build 13, ~1 week)

Real personalization data flowing.

- DB: `baby_checkins` table (sleep + feed entries, per-day) + RLS
- Edge function: `ai-baby-schedule-recommend` (Haiku 4.5, takes last N check-ins + prefs, returns nap times + feed cadence as structured JSON)
- Screen: "Baby's check-in" replaces DailyCheckin route (mom-mood content moves to Mom hero on Home as a softer prompt)
- Schedule card on Home: "Today's plan" — recommended naps + feeds
- Preference surface: Settings → Baby preferences → sleep approach + feeding method + solids stage

### Phase 5.3 — Pro subscription + Playbook generation (Build 14, ~1-2 weeks)

The monetization beat.

- DB: `subscriptions` table + Stripe webhook → `users.is_pro`
- Stripe Connect or direct Stripe subscription (we already have @stripe/stripe-react-native bumped to 0.66)
- Paywall screen — Pro vs Free comparison card
- Feature gates: Playbook content + Mom hacks gate on `users.is_pro = true`
- Edge function: `ai-playbook-generate` (Sonnet weekly cron, generates a 7-day playbook from prefs + recent check-ins; cached in `playbooks` table)
- Mom hacks content store — start with hand-curated 20-30 cards, expand from there

---

## Risk flags

- **App Store guidelines 3.1.1**: subscriptions for health-adjacent content are permitted, but the paywall copy can't claim medical efficacy. "Personalized playbook" is fine; "Medical advice for your baby" would get rejected.
- **HIPAA-adjacent posture**: baby check-in data goes into a `baby_checkins` table that's already health-info-shaped. RLS owner-only + encrypted at rest (Supabase default) + the same `beforeSend` Sentry scrubbing we already do covers us, but flag for counsel review before Pro launches.
- **Sleep schedule recommendations + liability**: every recommendation needs a "not medical advice" disclaimer banner. The AI prompt should be conditioned to never suggest anything that overrides pediatrician guidance.
- **Mom hacks + "tried by moms"**: framing as crowd-wisdom (not clinical advice) is the right Section 230-shaped framing, but each card needs an explicit "not medical advice" footer. The Risk & Compliance doc (`docs/source/Village_Risk_and_Compliance.md`) covers this for Milk + Gear; extend to Mom Hacks before launch.

---

## What I need from you before I start writing code

Answers to the 6 open questions above, or "ship Phase 5.1 with my best guesses and we iterate." Either works.

Phase 5.1 is OTA-able and reversible, so if you want me to scaffold the UI shell while you think through monetization, I can ship that in the next ~90 min.

