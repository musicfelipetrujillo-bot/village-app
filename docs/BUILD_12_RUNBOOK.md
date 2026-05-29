# Build 12 Runbook

Step-by-step for triggering Build 12. Follow top to bottom. Estimated wall-clock: **35-50 min** (most of it is EAS Build running unattended).

**Pre-flight assumption**: Build 11 is approved and at least one external tester has confirmed it works.

---

## What ships in Build 12

| Change | Type | Already committed? |
|---|---|---|
| Manual PDF export (`expo-print` + `expo-sharing`) | Native | ✅ `094f968` |
| 3 stale Info.plist permissions removed (`NSContacts`, `NSMicrophone`, `NSLocationAlways`) | Native | ✅ `094f968` |
| Sentry source-map auto-upload re-enabled | Build pipeline | ⚠️ Pending your Sentry token |
| All polish OTAs published since Build 11 | JS | Auto-included via prebuild |

---

## Step 1 — Get a Sentry auth token (5 min)

1. Open https://sentry.io → log in
2. **Settings → Auth Tokens → Create New Token**
3. Name: `villie-eas-build`
4. Scopes (tick exactly these, nothing else):
   - `project:write`
   - `project:releases`
5. Click **Create Token**
6. Copy the token (looks like `sntrys_eyJ...`). **Save it to 1Password** — Sentry only shows it once.

---

## Step 2 — Drop the token into EAS env (1 min)

In your terminal:

```bash
cd "/Users/gp/The Village App/village-app/apps/mobile"
npx eas-cli env:create \
  --scope project \
  --visibility encrypted \
  --name SENTRY_AUTH_TOKEN \
  --value "<paste the token from step 1>"
```

Verify it landed:

```bash
npx eas-cli env:list --scope project | grep SENTRY_AUTH_TOKEN
```

Expect one row with `(encrypted)`.

---

## Step 3 — Flip the Sentry upload flag in `eas.json` (30 seconds)

Edit `apps/mobile/eas.json` under `build.production.env`:

```diff
-        "SENTRY_DISABLE_AUTO_UPLOAD": "true"
+        "SENTRY_ORG": "village-app",
+        "SENTRY_PROJECT": "mobile"
```

(Just remove `SENTRY_DISABLE_AUTO_UPLOAD` entirely and add the two new keys. The token comes from EAS env at build time.)

> **If your Sentry org / project slugs are different from `village-app` / `mobile`**, check Sentry → Settings → Projects → villie → "Project Slug" and "Organization Slug" and use those instead.

Commit:

```bash
cd "/Users/gp/The Village App/village-app"
git add apps/mobile/eas.json
git commit -m "Build 12: enable Sentry source-map auto-upload"
```

---

## Step 4 — Trigger the build (30 min unattended)

```bash
cd "/Users/gp/The Village App/village-app/apps/mobile"
npx eas-cli build --platform ios --profile production
```

EAS will:
1. Prompt for App Store Connect credentials if not cached (use the same Apple ID from `eas.json` submit block)
2. Upload your project to EAS Build servers
3. Run `expo prebuild` server-side (regenerates `ios/` from the new `app.json` — so the stale plist permissions stay deleted and `expo-print` + `expo-sharing` get pod-linked)
4. Run `pod install`
5. Run `xcodebuild` → produce the IPA
6. Upload Sentry source maps (because of the token + org/project env)
7. Submit the IPA to App Store Connect (because `eas.json` submit block has `appleId` + `ascAppId` + `appleTeamId`)

**Watch the build at**: `https://expo.dev/accounts/villagepeople/projects/the-village-app/builds`

**Expected duration**: 18-25 min for the build itself + 2 min for ASC upload.

---

## Step 5 — Once Build 12 lands in ASC (5 min)

1. Open App Store Connect → villie → **TestFlight**
2. New Build 12 appears under Internal Testing (Expo Team) immediately
3. Install on your phone via TestFlight
4. **Smoke test the new capabilities**:
   - Open Manual → any chapter → hamburger menu → **Print as PDF** → expect the iOS share sheet to appear with a real PDF (not the "coming soon" alert)
   - Check that the PDF visually matches the v3 brand kit (cream background, Playfair italic, Plus Jakarta body)
   - Settings → Notifications → all your prior preferences still there (didn't reset on update)
   - Sign out + sign back in with Apple → still works
5. Trigger a known crash (`useless menu item that throws` or modify a debug-only screen) → wait 60s → check Sentry → confirm the stack trace shows `.ts` filenames and line numbers, not bundled JS

If any of the above fails, do NOT submit Build 12 for external review yet. Roll back via dashboard (withdraw the build) and ping me with the error.

---

## Step 6 — Submit Build 12 to Apple Beta App Review (1 min)

1. App Store Connect → TestFlight → **Villie Testers** group → Builds tab
2. Click `+` → select **Build 12**
3. Apple will prompt that there's a build in review (Build 11). Withdraw it first if Build 11 hasn't approved yet.
4. Submit Build 12 for review
5. Subsequent builds in this version (12 → 13 → ...) **fast-track** in minutes, not 24h, because Apple only does full review on the first build per version.

---

## Step 7 — Update `TESTFLIGHT_STATE.md` (1 min)

Add a row to the Build train table:

```
| 12 | <new EAS ID> | **In TestFlight + In Review** | PDF export wired, 3 stale plist permissions removed, Sentry source maps re-enabled | All of Build 11 + working "Print as PDF" + readable crash stacks | TBD |
```

Commit + push.

---

## Rollback plan (if Build 12 is bad)

EAS Build doesn't have a one-click rollback, but you have two recovery paths:

**Option A — Withdraw + push an OTA fix on the Build 12 channel**
1. Withdraw Build 12 from Apple Review
2. Identify the bug
3. Fix in code
4. `eas update --branch production --message "fix: ..."` — patches Build 12 if testers already installed
5. Submit Build 13 to ASC

**Option B — Tell testers to roll back to Build 11**
1. Withdraw Build 12 from Apple Review
2. App Store Connect → TestFlight → Villie Testers → Builds → re-add Build 11
3. Testers reinstall Build 11 from TestFlight

Prefer Option A unless the bug crashes on launch.

---

## What's deliberately NOT in Build 12

Postponed to Build 13 / 14 so we ship the lowest-risk change first:

- Daily check-in custom mood SVGs (already shipped via OTA — pure JS, no native need)
- SpecialistsMapScreen Map button (already shipped via OTA)
- Universal-link path registration for `/auth/confirm/` (would need new AASA, not critical since custom URL scheme `com.villieapp.mobile://` works)

If Felipe's voice recording introduces native asks (new camera modes, biometrics, file pickers, etc.), batch them into Build 13.
