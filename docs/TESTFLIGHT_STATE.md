# TestFlight + Build State

Single-page status board. Update as builds + testers change. Last touched: **2026-05-28 PM**.

## Roster

### Internal testers (instant install, no Apple review)
Group: **Villie Team (Expo)** — auto-managed by EAS Build.

| Email | Apple ID role | Current build | Notes |
|---|---|---|---|
| `felitrujillo95@hotmail.com` | Account Holder | Build 10 (installed) → Build 11 (pending) | iPhone 13 mini · iOS 26.3.1 · 49 sessions on Build 10 |

### External testers (require Apple Beta App Review)
Group: **Villie Testers** — manually managed. **5 testers as of 2026-05-28 PM.**

| Email | Status | Install state | Beta Review for them is gated by |
|---|---|---|---|
| `cindya101@bellsouth.net` (Cindy Alcivar) | Invited | "No Builds Available" — waiting on Apple | Build 11 review |
| `alanahardan@gmail.com` | Invited | "No Builds Available" — waiting on Apple | Build 11 review |
| `giulipino97@gmail.com` (Giulianna Pino) | Invited | "No Builds Available" — waiting on Apple | Build 11 review |
| `daniela.azari@gmail.com` (Daniela Azari) | Invited | "No Builds Available" — waiting on Apple | Build 11 review |
| `sophia.azari@gmail.com` (Sophia Azari) | Invited | "No Builds Available" — waiting on Apple | Build 11 review |

### Auth.users (people who actually signed in to villie)
Real account creations as of last check (via Supabase `auth.users`):

| Email | Provider | Created | Who |
|---|---|---|---|
| `fele_trujillo@hotmail.com` | apple | 2026-05-26 | Felipe (Apple Sign-In test from Build 4) |
| `musicfelipetrujillo+keyrotation@gmail.com` | email | 2026-05-15 | Felipe (test) |
| `musicfelipetrujillo@gmail.com` | email | 2026-05-07 | Felipe |
| `felitrujillo95@hotmail.com` | email | 2026-04-27 | Felipe main |
| `demo-donor-{1,2,3}@village.demo` | email | 2026-04-29 | Seed data — ignore |
| `felitrujillo95+{curltest,smoketest1}@hotmail.com` | email | 2026-04-27 | Felipe test accounts |

External testers haven't created accounts yet — Apple hasn't approved a build for them.

## Build train

EAS auto-increments buildNumber. Apple sees these as separate "Build N" rows under Version 1.0.0.

| # | EAS ID | Status | What it added vs prior | What works | What's broken |
|---|---|---|---|---|---|
| 4 | `d81f0ec0` | TestFlight (old) | Initial submission | Apple Sign-In, all v1 verticals | Google Sign-In (PKCE nonce), no v3 brand, no V+bee icon, OTAs deaf |
| 6 | `df44df09` | TestFlight (skipped) | EAS autoincrement | — | Never installed |
| 7 | `817a4999` | TestFlight | v3 brand + V+bee icon + `updates.url` added | v3 design, salmon italics | Still no channel header → OTAs deaf, old V splash flash |
| 8 | `d81f0ec0`?* | TestFlight | V+bee icon properly staged | Icon shows | OTAs deaf, old V splash |
| 9 | `d09302b4` | TestFlight (review withdrawn) | V+bee splash, `EXUpdatesRequestHeaders` in plist | — | EAS regenerated plist during build, channel header dropped → OTAs deaf |
| 10 | `2ee99b88` | **Currently in TestFlight + In Review** | Google Sign-In env wiring, Villie Plans nav, OAuth nonce fix | Apple Sign-In, Google Sign-In, V+bee icon, V+bee splash | OTAs **still deaf** — plist regenerated again at build time |
| 11 | `14805f73` | **In TestFlight, awaiting Apple processing** | `updates.requestHeaders` in **app.json** (not just plist) — survives prebuild | All of above + every OTA published since Build 10 lands automatically on cold launch | TBD until first install |

## OTAs published (would all reach the device starting Build 11+)

Order matters — they apply in published order. Build 11 picks up the latest at first launch.

| OTA ID | Published | Contents |
|---|---|---|
| `6bc46b82` | 2026-05-28 | Manual: checklist top, X/5 progress banner bottom |
| `ec9249cd` | 2026-05-28 | Custom SVG mood faces, Specialists map view + Map button |
| `56d5c437` | 2026-05-27 | Villie Plans tile → EventsList navigation fix |
| `8a57e011` | 2026-05-27 | `EXPO_PUBLIC_OAUTH_GOOGLE_ENABLED=1` in .env |
| `54bb7358` | 2026-05-27 | Google Sign-In re-enabled via edge function exchange |

## Apple Beta Review (external) — current state (2026-05-28 PM)

- **Build 11**: In TestFlight as "Ready to Submit" — needs to be attached to Villie Testers + submitted for review
- **Build 10**: "Waiting for Review" by Apple — withdrawing this to swap to Build 11
- **Build 9**: was approved, then superseded; testers never installed (Build 10 became the candidate)

**Action right now**: Path B — withdraw Build 10's review, attach Build 11 to Villie Testers, submit Build 11 for Beta App Review. Resets the review clock but means testers' first install is the OTA-receiving Build 11.

Workflow when Build 11 finishes EAS pipeline:
1. App Store Connect → TestFlight → Villie Testers → Builds tab
2. Click `+` → select **Build 11**
3. Apple blocks ("one build per version in review at a time") — withdraw Build 10 review, then submit Build 11
4. Subsequent builds in same train fast-track (minutes, not 24h)

## Database seed state

Pre-launch test data Felipe has populated (for verifying flows):

| Surface | Seed state | Source |
|---|---|---|
| Specialists | 7 specialists × 2 priced services each | `INSERT specialist_services` ran 2026-05-28 |
| Gear listings | 8 listings × 1 placeholder image each | `INSERT gear_listing_images` ran 2026-05-28 |
| Events | 4 events (2 Miami local + 2 webinars) | Migration 010 seed |
| Brand deals / perks | 4 perks (Comotomo, UPPAbaby, Bobbie, Nesting Co.) | Migration 011 seed |
| Manual videos | hand-authored content per chapter | Migrations + Mux uploads |
| Milk donors | 3 demo donors | Migration 005 seed |

## App Store Connect URLs (bookmark these)

- All builds: https://appstoreconnect.apple.com/apps/6773357128/testflight/ios
- Villie Testers group: TestFlight → External Testing → Villie Testers
- Test Information (where reviewer notes + Privacy URL live): https://appstoreconnect.apple.com/apps/6773357128/testflight/testinfo
- App Privacy: https://appstoreconnect.apple.com/apps/6773357128/distribution/privacy
- App Store ID: **6773357128**

## EAS dashboard URLs

- All builds: https://expo.dev/accounts/villagepeople/projects/the-village-app/builds
- All OTAs: https://expo.dev/accounts/villagepeople/projects/the-village-app/updates
- Channel mapping (must show production branch pointed at production channel): https://expo.dev/accounts/villagepeople/projects/the-village-app/channels

## Reminders / known issues

- **Apple Sign-In JWT** rotates ~2026-11-16. Set calendar reminder. Source-of-truth: `memory/project_oauth_setup.md`.
- **Apex AASA redirect** (`villieapp.com/.well-known/apple-app-site-association` returns 307 to www) — universal links don't deeplink for the apex domain. Website-side fix tracked as Task #67.
- **Sentry source maps**: disabled in production env (`SENTRY_DISABLE_AUTO_UPLOAD=true`). Production crash stacks show bundled JS line numbers, not .ts. Wire `SENTRY_AUTH_TOKEN` as EAS secret to re-enable.
- **OneSignal external_id** registration: only fires for signed-in users. Push notification testing requires a tester to sign in at least once.

## How to update this doc

After any of these events, edit this file:

| Event | What to update |
|---|---|
| New build kicks off | Add row to "Build train" with EAS ID + status |
| OTA published | Add to "OTAs published" table |
| New tester invited | Add to "Roster" |
| Apple Beta Review state changes | Update "Apple Beta Review" section + tester install state |
| New seed data added | Update "Database seed state" |

Commit changes as `docs: TestFlight state update — <one-line summary>` so the audit trail is searchable.
