# First TestFlight Build — Complete Walkthrough

Created 2026-05-25. The complete path from "config is ready" → "app in TestFlight." Lives alongside OPS_RUNBOOK §4 (which covers sim builds) — this doc covers the cloud-build-and-distribute path.

## Pre-flight checklist (all green)

✅ Apple Developer Program membership active (Team `B9BRJPBM6G`)
✅ Bundle ID `com.villieapp.mobile` reserved on developer.apple.com
✅ EAS CLI installed, you're logged in as `@villagepeople`
✅ `apps/mobile/eas.json` production env has hosted Supabase URLs + OAuth flag on
✅ `apps/mobile/eas.json` submit block has real Apple ID + Team ID
✅ `apps/mobile/app.json` bundleIdentifier matches Apple Developer Console
✅ OneSignal extension bundle `com.villieapp.mobile.OneSignalNotificationServiceExtension` reserved

## Step 1 — Generate an App Store Connect API key (one-time)

Why an API key vs. password-based login: 2FA on your Apple ID will interrupt the build queue. API keys bypass 2FA. Also reusable across machines / CI later.

1. Go to **https://appstoreconnect.apple.com** → **Users and Access** → **Integrations** tab
2. Click **App Store Connect API** → **+** to generate a new key
3. **Name**: `Villie EAS Build` (or whatever you remember)
4. **Access**: `Admin` (you need this for build + submit + app creation)
5. Click **Generate** — Apple gives you a **.p8 file** to download. **This is your only chance to download it.** Save it.
6. Note the **Key ID** (shows in the table) and **Issuer ID** (top of the page, looks like a UUID).

Stash these three values somewhere safe (1Password, the same place the Apple Sign-In `.p8` lives):
- `.p8 file path` → e.g. `/Users/gp/The Village App/villie-asc-api-key.p8`
- `Key ID` → e.g. `2L8283N4G9`
- `Issuer ID` → e.g. `69a6de80-…-9f5cb1b5e8e0`

## Step 2 — Kick off the build

From `apps/mobile`:

```bash
npx eas-cli build --platform ios --profile production
```

What you'll see — each prompt explained:

### Prompt A: "What would you like your iOS app's bundle identifier to be?"
**Answer**: `com.villieapp.mobile` (matches app.json — should pre-fill)

### Prompt B: "Generate a new Apple Distribution Certificate?"
**Answer**: `Yes` (first build only — EAS will manage it after this).

### Prompt C: "Generate a new Apple Provisioning Profile?"
**Answer**: `Yes` (first build only). EAS auto-creates it from the App Store Connect API key.

### Prompt D: "Log in to your Apple Developer account"
Choose the **App Store Connect API key** option (NOT Apple ID + password — 2FA breaks unattended builds).
- Path to `.p8`: paste the path from Step 1
- Key ID: paste
- Issuer ID: paste

EAS caches this in your account so you only paste once across machines.

### Prompt E: "Push notification certificate?"
**Answer**: `Yes` if asked — needed for OneSignal to work in TestFlight. EAS generates and uploads automatically.

### Build queues
- Tail the progress URL in your terminal output (`https://expo.dev/accounts/villagepeople/projects/.../builds/<id>`)
- 10–25 minutes typical. Mac Mini infrastructure on EAS side.
- Build steps: Install deps → Prebuild → Pod install → Run path-with-spaces patches → Xcode archive → Sign → Upload

### If the build fails

Most common first-build errors + fixes:

| Error | Cause | Fix |
|---|---|---|
| `EAS project not linked correctly` | projectId in app.json is legacy | `npx eas-cli project:init` to re-link (creates fresh project under villagepeople) |
| `Bundle identifier not available` | Bundle never claimed on Apple Dev | developer.apple.com → Identifiers → New → `com.villieapp.mobile` |
| `Provisioning profile fails to generate` | API key permissions insufficient | Regenerate with `Admin` role (not `Developer`) |
| `Pod install failed` on iOS 26 | Path-with-spaces patches | Already wired into prebuild pipeline; if it still fails, see `memory/project_ios26_build_fixes.md` |
| `Sentry source map upload failed` | Sentry auth token missing | Either add `SENTRY_AUTH_TOKEN` to EAS secrets or set `SENTRY_DISABLE_AUTO_UPLOAD=true` in production env |

## Step 3 — Create the App Store Connect app entry

After the build finishes, EAS won't auto-create the ASC app on the FIRST submit. Do this manually:

1. Go to **https://appstoreconnect.apple.com** → **Apps** → **+** → **New App**
2. Fill in:
   - **Platform**: iOS
   - **Name**: `villie` (lowercase — wordmark canon)
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: select `com.villieapp.mobile` from the dropdown (must already exist on developer.apple.com)
   - **SKU**: `villie-ios-v1` (or anything internal; not user-visible)
   - **User Access**: Full Access
3. Click **Create**
4. Note the **App Store ID** that gets generated (shows in App Information → General → Apple ID). Looks like `6480000000`.

Add it to `eas.json` so future submits are non-interactive:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "musicfelipetrujillo@gmail.com",
      "appleTeamId": "B9BRJPBM6G",
      "ascAppId": "6480000000"
    }
  }
}
```

## Step 4 — Submit to TestFlight

```bash
npx eas-cli submit --platform ios --latest
```

`--latest` grabs the most recent successful build. EAS uploads to App Store Connect.

What you'll see:

### Prompt: "Have you set up encryption export compliance?"
**Answer**: Most apps qualify for the **standard exemption** — encryption is only used for HTTPS / Apple system frameworks / authentication. Set the following in `app.json`:

```json
"ios": {
  "config": {
    "usesNonExemptEncryption": false
  }
}
```

This sets ITSAppUsesNonExemptEncryption=NO in the Info.plist, and Apple won't ask again on subsequent builds. **If we ever add custom crypto (HIPAA-grade transport encryption, message-level e2e), revisit this.**

### After submit
- 5–10 min upload to App Store Connect
- 15–30 min Apple processing ("Processing your build…")
- Email when the build is ready for testing

## Step 5 — Configure TestFlight access

In **App Store Connect → Your App → TestFlight**:

### Internal testing (no review needed, instant)
- **Internal Testers**: up to 100 people in your team. They get the build immediately.
- Add: Users and Access → Add user → select role (Developer / App Manager etc) → save → Internal Testing tab on the app → Add Testers → pick them.

### External testing (requires Apple review — first time only)
- Up to 10,000 testers via email or public link
- First external build needs a ~24hr review from Apple (not the full App Store review — much lighter)
- Subsequent builds in the same train auto-approve
- **Test Information** is mandatory (what testers should look for + how to contact you). Pre-populate:
  - **Email**: musicfelipetrujillo@gmail.com
  - **Test info**: "First TestFlight build of villie — a postpartum mom-support app. Please test signup, daily check-in, and the Manual tab. Known: gear marketplace is cash-only, no payment processing."
  - **What to test**: "Sign in → daily check-in → browse Manual chapters → open one piece. Tap around. Tell me anything that feels broken."

### Promo Codes / Marketing
Skip for TestFlight — those are App Store post-launch concerns.

## Step 6 — Install on a real device

1. Tester downloads **TestFlight** from the App Store
2. Opens the invite email or link
3. Taps "Accept" → "Install"
4. Build appears in TestFlight app — tap to install

## Verify the full OAuth + payment + push flow works

Once installed on a real iPhone:

### OAuth (per OPS_RUNBOOK §3.5)
- Sign In with Apple → real Face ID prompt → app comes back authed
- Continue with Google → real Google sheet → back authed
- Verify in Supabase:
  ```sql
  SELECT email, raw_app_meta_data->>'provider' AS provider, created_at
  FROM auth.users
  WHERE raw_app_meta_data->>'provider' IN ('apple','google')
  ORDER BY created_at DESC LIMIT 5;
  ```

### Stripe (V1 Specialist booking)
- Book a Calendly specialist (any active one) → tap Pay → real Apple Pay sheet → confirm with Face ID
- Verify with a Stripe dashboard test charge (live mode → test the booking flow with a real $0.50 charge that gets refunded)

### Push notifications
- Background the app, then trigger a push:
  - Either fire an `appointment-reminder` manually via Supabase Edge Function invoke
  - Or wait for the next 15-min appointment cron tick
- Push should land on the lock screen, tap to open → goes to the appropriate deep link

### Universal links (per OPS_RUNBOOK §3.6)
- Open Safari → paste a `https://villieapp.com/m/?v=<video-id>` URL → tapping should open the app to that manual video, not Safari

## Update OPS_RUNBOOK

After the first successful TestFlight build:
1. Update §1 Account inventory with the ASC App ID once known
2. Update §5 Rotation calendar — add the ASC API key (rotate yearly, same as Apple Sign-In JWT)
3. Add a `next` cadence note: rebuild for TestFlight whenever native deps change (Stripe, OneSignal, Expo SDK, RN). JS-only changes go OTA via EAS Updates, no rebuild needed.

## Subsequent builds (everything's cached now)

Once the first build is done:

```bash
cd apps/mobile
npx eas-cli build --platform ios --profile production --auto-submit
```

`--auto-submit` chains the submit step. Then you wait for the email and install via TestFlight.

For JS-only changes, use OTA updates instead — they ship to TestFlight users without rebuilding:

```bash
npx eas-cli update --branch production --message "what changed"
```

## When the first TestFlight build is live

You'll know because:
- Email from Apple: "Your build is ready to test"
- TestFlight app shows villie under "Apps"
- The build version number matches what EAS reported

That's the moment to validate the gates that the sim can't:
- ✅ Real Apple Sign-In + Google Sign-In round-trips
- ✅ Real Stripe Apple Pay (V1 Specialist booking)
- ✅ Real Face ID enrollment + auth
- ✅ Real OneSignal push receipt on lock screen
- ✅ Real universal-link round-trip from Safari
- ✅ Real Supabase auth.users rows landing with the correct provider field
- ✅ Real Resend invite email click → app deep-link from Mail

## Cost notes

- Apple Developer Program: $99/year — covers TestFlight + App Store + all certificates
- EAS Build: free tier covers ~30 builds/month on the medium queue. Higher tier ($19/mo standard, $99/mo production) for priority queues + more builds — only matters if you're rebuilding multiple times a day
- Apple Sign-In JWT rotation: free, but set a reminder for Nov 16 per §5 Rotation calendar
