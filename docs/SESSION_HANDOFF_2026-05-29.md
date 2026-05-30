# Session Handoff — 2026-05-29

Felipe + Claude (Opus 4.7) marathon session. ~10 hours. Resume in a fresh Claude session by reading this doc + the docs it cross-refs.

---

## Where we are RIGHT NOW (timestamps in ET)

### Build pipeline
- **Build 11**: external testers (Villie Testers) had it. Should be replaced by 13 once Apple approves 12 → 13. Discard 12.
- **Build 12**: 6:24 PM finished, 8:20 PM submitted to ASC, **HAS A CRASH** on Print as PDF (root cause: expo-print/sharing pinned to wrong SDK majors). Do NOT promote Build 12 to external testers.
- **Build 13**: 9:04 PM finished. Auto-submitted to ASC. **THIS IS THE GOOD ONE.** Fixes the PDF crash by pinning expo-print → ~15.0.8 and expo-sharing → ~14.0.8 (SDK 54-aligned).
- Adds DSN env var so Sentry reports crashes from Build 13+
- Adds workspace-root `.npmrc` with `node-linker=hoisted` so EAS Build can resolve `@expo/cli` from the direct bin invocation (was crashing pre-fix with "expo config --json exited with non-zero code")

### Tester unblock status (since this morning's fix)
- ✅ Alana Hardan — signed in 12:03 ET
- ✅ Giulianna Pino — signed in 14:47 ET
- ⏳ Cindy Alcivar — account deleted for fresh-signup recovery, hasn't retried
- ⏳ Daniela Azari — not started
- ⏳ Sophia Azari — not started

Felipe **still needs to send the tester messages** to Cindy/Daniela/Sophia. Draft in chat history; key paragraph: "Open villie → tap 'Sign up with Apple' → Face ID → 'Share My Email' → pick stage + ZIP → you're in."

### V5 progress
- **5.1 SHIPPED** as OTA `c62ac3cb` — Mom hero card on Home + Manual/Playbook toggle + retired Mom Manual track. Pure JS, fully reversible.
- 5.2 + 5.3 documented in `docs/V5_GROW_WITH_YOU.md`. Felipe approved: free general manual + Pro $9.99/mo or $59/yr, AI per recommendation (Haiku), hand-curated mom hacks. Open questions noted at bottom of that doc.

### App Privacy
- ✅ Published in ASC this afternoon. All 14 data types configured. "Data Used to Track You" = NONE (the critical one). One Crash Data correction during walkthrough.

### Sentry
- ✅ Project `mobile` exists in `villie-app` org
- ✅ Auth token `villie-eas-build` (Source Map Upload + Release Creation + Code Mappings) in EAS env as `SENTRY_AUTH_TOKEN` (secret visibility)
- ✅ DSN in BOTH `apps/mobile/.env` AND `apps/mobile/eas.json` (production env)
- ⚠️ Sentry SDK plugin in app.json is just `"@sentry/react-native"` — config plugin warning says it wants `organization`/`project` in plugin params; tolerable (env vars are the fallback)

### Auth/Supabase
- ✅ Site URL fixed to `https://villieapp.com` (was localhost), Redirect URLs include `com.villieapp.mobile://**`, `https://villieapp.com/**`, `https://www.villieapp.com/**`
- ✅ `villieapp.com/auth/confirm/` landing page live (bilingual EN/ES, "Take me to villie" CTA + deep-link)

---

## What's NEXT after Build 13 lands

In order:

1. **Verify Build 13 in ASC TestFlight** (https://appstoreconnect.apple.com/apps/6773357128/testflight/ios)
2. **Install on phone via TestFlight**
3. **Smoke test PDF export** (Manual → any chapter → ⋯ → Print as PDF) — expect REAL share sheet with PDF
4. **If PDF works**: ASC → TestFlight → **Villie Testers** group → Builds → `+` → select Build 13 → submit to Apple Beta App Review
5. **If PDF still crashes**: Sentry will have the stack trace. Check https://villie-app.sentry.io/projects/mobile/issues/ — paste me the top issue.

---

## Recovery recipes

### EAS Build "expo config exited 1" error
If this comes back, check:
- `.npmrc` exists at workspace root with `node-linker=hoisted`
- `node_modules/@expo/cli` exists at workspace root after `pnpm install`
- If both true but error persists, run `rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install`

### App Privacy form changes
- All answers documented in `docs/APP_PRIVACY_QUESTIONNAIRE.md` — paste-ready for any future re-submit

### Native module crashes from version mismatch
- Run `npx expo install --check` to see all out-of-SDK-version modules
- Run `npx expo install <package-name>` to pin to SDK-aligned version
- Always commit `package.json` + `pnpm-lock.yaml` together

---

## Open follow-ups (carry to next session)

| # | Item | Priority |
|---|---|---|
| A | Sentry plugin config in app.json (add organization + project params) | low |
| B | Wire EAS submit groups for external auto-assign | low (only worth it at 50+ testers) |
| C | Apple Sign-In JWT rotates 2026-11-16 — calendar reminder | none (we have time) |
| D | V5 Phase 5.2 — Baby's check-in + AI schedule generator (Build 14 batch) | medium (after 5.1 lives a few days) |
| E | V5 Phase 5.3 — Pro paywall + Playbook generator | high (revenue) |
| F | App Store screenshots — `docs/SCREENSHOT_PLAN.md` has the 8-screen sequence | medium (blocks public launch) |
| G | Submit to public App Store Review (not just Beta App Review) | after E + F |

---

## Key docs to read in fresh session

| Doc | Why |
|---|---|
| `docs/SESSION_HANDOFF_2026-05-29.md` | This file. |
| `docs/TESTFLIGHT_STATE.md` | Single source of truth for build train + OTAs |
| `docs/BUILD_12_RUNBOOK.md` | Exact steps for kicking native builds (Build 13/14/15 reuses same flow) |
| `docs/V5_GROW_WITH_YOU.md` | V5 plan: Mom hero, Manual restructure, Pro tier |
| `docs/APP_PRIVACY_QUESTIONNAIRE.md` | Privacy answers for any ASC re-submit |
| `docs/SCREENSHOT_PLAN.md` | App Store screenshot capture plan |
| `docs/I18N_DISCHARGE_AUDIT.md` | ES copy clinician-grade verdict |
| `docs/app-store-submission.md` | Marketing copy + listing fields |
| `memory/project_oauth_setup.md` | Apple/Google OAuth setup (JWT expires Nov 2026) |

---

## Commands the next session will need

```bash
# Where you are
pwd  # /Users/gp/The Village App/village-app

# Status checks
git log --oneline -10
cd apps/mobile && /tmp/node_modules/.bin/eas build:list --platform ios --limit 3 --non-interactive

# Trigger another build (Build 14 if needed)
cd apps/mobile && /tmp/node_modules/.bin/eas build --platform ios --profile production --auto-submit --non-interactive

# Publish an OTA
cd apps/mobile && /tmp/node_modules/.bin/eas update --branch production --message "<short message>"
```

**Note**: The `/tmp/node_modules/.bin/eas` is a temporary install. If it's gone, run `npm install eas-cli` in `/tmp` first.

---

## Final state of session

- ✅ Build 13 building/finished and auto-submitting to ASC
- ✅ App Privacy form published
- ✅ V5 Phase 5.1 shipped via OTA
- ✅ Sentry wired
- ⏳ Felipe needs to smoke-test PDF on Build 13 when it lands
- ⏳ Felipe needs to manually submit Build 13 to Villie Testers external group after smoke test
- ⏳ Felipe still owes 3 tester messages (Cindy, Daniela, Sophia)

Sleep well. The new session can pick this up cleanly.
