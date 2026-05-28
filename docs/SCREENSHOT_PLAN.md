# App Store Screenshots — Capture Plan

The 8-screen sequence, the per-screen overlay copy, the device classes, and a step-by-step simulator capture recipe.

**Status**: drafted 2026-05-28. Captures pending — re-run when Build 11 (or whichever build ships to App Store) is installed and the production Supabase seed is loaded.

---

## Device classes required

App Store Connect needs at least one of these, ideally both:

| Device class | Required dimensions | Source device / sim |
|---|---|---|
| iPhone 6.9" (iPhone 16 Pro Max) | **1290 × 2796** | iPhone 16 Pro Max simulator @ Default scale |
| iPhone 6.5" (iPhone 11 Pro Max) | **1242 × 2688** | iPhone 11 Pro Max simulator @ Default scale |
| iPhone 5.5" (iPhone 8 Plus) | 1242 × 2208 | OPTIONAL — Apple stopped requiring 2024+ |
| iPad 13" (iPad Pro 12.9 gen 6) | 2048 × 2732 | **NOT required** — `ios.supportsTablet: false` |

> Minimum: 3 per device class. Maximum: 10. We target 8 for the hero rotation.

---

## The 8-screen sequence

Order matters — the first 3 screens are what most users see in search results before tapping "more". Lead with strongest narrative; don't open with a settings screen.

| # | Screen | Why it's here | Overlay headline | Overlay subline |
|---|---|---|---|---|
| 1 | **Home feed — Week N hero card** | First moment of "this app knows me." Pulls the "Week 4 · Sleep" hero band + the daily check-in strip + the Manual tile. | **A village for every mom** | One quiet place for the first six weeks home. |
| 2 | **Manual chapter — week + piece stream** | The Manual is villie's killer feature. Show a chapter with video + article + checklist + illustration stacked. Use the v3 brand wash. | **The Manual.** | 52 weeks. Video, article, checklist — written by clinicians, tuned to your baby. |
| 3 | **Daily check-in — input + reply** | Shows the warm AI reply card with the crisis row. Capture mid-flow, mood selected, AI reply visible. | **One tap to be heard.** | The check-in listens. Crisis lines are one tap away when you need them. |
| 4 | **Specialists — map + list** | The directory in its strongest form. Use SpecialistsMapScreen with Miami pins + the list drawer pulled up. | **Find your team.** | OB/GYNs, doulas, lactation, pediatricians, PPD therapists — filter by insurance and language. |
| 5 | **Milk Connect — donor profile** | The peer-sharing differentiator. Pull the SafeMilkHandoff trust panel + verified mom badge. | **Milk-sharing, hand-to-hand.** | Verified moms, allergy disclosures, safe-handoff walkthrough. Cash on pickup. |
| 6 | **Gear marketplace — listing detail** | Show the CPSC-checked badge + photos + safe-meeting checklist. | **Pre-loved gear, recall-checked.** | Every listing screened against CPSC before it goes live. Local pickup, cash only. |
| 7 | **Weekly Journey — chapter + crisis row** | Show the chapter feed with the discreet "I need help" crisis link in context. | **Built around 0 to 6 weeks.** | Hospital-discharge ready. Bilingual. Crisis access on every screen. |
| 8 | **Me — Saved hub** | Closes the loop — what villie remembers for you. Latest 3 saved videos + specialists + donors + gear. | **Saved, in one place.** | Everything you bookmarked. Resume any chapter, contact any specialist, in one tap. |

> Skip Connect / community rooms — that tab is hidden in this build.

---

## Caption overlay design

Place captions ABOVE the screenshot frame, not inside the app UI.

- **Background band**: solid cream `#F4ECD8` (villie cream), 320pt tall above the frame
- **Eyebrow** (above headline): Caprasimo wordmark "villie" at 80pt, color cinnamon `#C07840`
- **Headline**: Playfair Display Bold italic, 88pt, color cocoa ink `#3D1F0E`. Single line, italic emphasis on the last word.
- **Subline**: Plus Jakarta Sans Regular, 36pt, color walnut `#7A4A28`. Up to two lines, max 75 characters per line.
- **Frame**: device shell mockup at 95% of the screenshot area, drop shadow `0px 18px 32px rgba(61, 31, 14, 0.18)`

> Build the caption band template once in Figma / Sketch; export per screenshot. Use the in-app screenshot as the device-frame inner layer.

---

## Simulator capture recipe

1. Boot iPhone 16 Pro Max simulator: `xcrun simctl boot "iPhone 16 Pro Max"` (or open via Xcode → Open Developer Tool → Simulator → File → Open Simulator)
2. Set the simulator to **English** locale first; capture the EN set, then switch to **Español** for the ES set.
3. Install the production build: drag the `.ipa` into the simulator window OR `xcrun simctl install booted ~/Downloads/villie-prod.ipa`. (Simulator installs run from the production scheme — do NOT use the debug local build.)
4. Sign in with the reviewer account `review-apple@villieapp.com` (or any seeded account in `auth.users`) and ensure the home feed shows the expected Week N hero.
5. Per screen: drive the app to the exact state, then `Cmd+S` in the simulator to save a PNG to `~/Desktop`. Captures land as `Simulator Screenshot - iPhone 16 Pro Max - YYYY-MM-DD at HH.MM.SS.png` at the native 1290 × 2796 pixel size — no resize needed.
6. Move all 8 PNGs into `marketing/screenshots/en/iphone-67/`. Mirror the ES set into `marketing/screenshots/es/iphone-67/`.
7. Repeat for iPhone 11 Pro Max simulator (1242 × 2688) — same 8 screens, same captions, into `iphone-65/`.

---

## Seed-data prerequisites (per `TESTFLIGHT_STATE.md`)

The production seed already has what we need:

| Surface | Seed state | Adequate? |
|---|---|---|
| Specialists | 7 specialists × 2 priced services each | ✅ Map has multiple pins |
| Gear listings | 8 listings × 1 placeholder image each | ✅ Detail screen renders cleanly |
| Events | 4 events (2 Miami local + 2 webinars) | ✅ Weekly card has content |
| Brand perks | 4 perks (Comotomo, UPPAbaby, Bobbie, Nesting Co.) | ✅ Perks tile is populated |
| Manual videos | hand-authored per chapter | ✅ Week 1 Sleep is the cleanest demo |
| Milk donors | 3 demo donors | ✅ Donor profile has the trust panel |

> If a future build adds richer seed, re-shoot screens 4-6 to take advantage. The screen layout itself doesn't change.

---

## Localization

Apple lets you upload **per-locale screenshots**. For villie:

- **English (United States)** — required, primary
- **Spanish (Mexico)** — recommended; the app's ES copy is clinician-grade (see `I18N_DISCHARGE_AUDIT.md`) so localized screenshots show off depth, not just an English app translated

> Don't ship Spanish screenshots until the ES locale's app store presence is reviewed for parity with the English copy in this doc.

---

## Re-shoot triggers

Re-capture screens when:
- A surface gets a visual rework (e.g. Manual piece-stream rebuild already done; next major design pass triggers a re-shoot)
- The brand kit tokens change
- A new vertical ships and replaces an existing screen in the rotation
- Seed data refreshes such that a screen looks empty

Commit the new PNGs to `marketing/screenshots/<locale>/<device>/` and bump the date at the top of this doc.

---

## What only YOU can do

| # | Item | Why |
|---|---|---|
| 1 | Build the caption-band Figma template | One-time design work; reusable per screenshot |
| 2 | Decide if ES screenshots ship at launch or in 1.1 | Product call — ES adds depth but doubles capture time |
| 3 | Capture and crop the 8 EN PNGs from simulator | I can't drive the Sim with reliable touch synthesis on iOS 26.4 (per memory) |
| 4 | Upload to App Store Connect → Media Manager | Manual upload, drag-drop in browser |

Everything else (copy, dimensions, order, overlay specs) is in this doc.
