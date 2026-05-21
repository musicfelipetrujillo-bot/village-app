# V1 Auth · Google + Apple Sign-In setup

> Code-stage shipped 2026-05-19. Buttons are gated behind
> `EXPO_PUBLIC_OAUTH_PROVIDERS_ENABLED='1'` and won't render until this doc
> is fully worked through. Until then the existing email/password flow is
> the only auth surface — same UX as today, nothing visible changed.

## Why both at once

Apple App Store guideline 4.8 requires Sign In with Apple to be offered
**alongside any other third-party login**. Shipping Google alone means
App Store rejection. So Google + Apple come as a pair, not sequential.

## What's already done in code

- Deps installed: `expo-apple-authentication`, `@react-native-google-signin/google-signin`
- `apps/mobile/src/lib/oauth.ts` — `signInWithGoogle()`, `signInWithApple()`, `configureGoogleSignIn()`, `isAppleSignInAvailable()`
- `apps/mobile/src/components/auth/OAuthButtons.tsx` — feature-flagged UI block (divider + Apple native button + Google button)
- Integrated into `LoginScreen` + `SignUpScreen` below the email/password CTA
- EN + ES i18n keys under `oauth.*`
- `app.json` plugins for both SDKs (Google's `iosUrlScheme` is a placeholder pending Step 1.3)
- `App.tsx` calls `configureGoogleSignIn()` once at boot when the flag is on

## What you do (in this order)

### Step 1 — Google Cloud Console (~10 min)

1.1. Open https://console.cloud.google.com → select or create a project named `Villie` (or reuse the one with your Google Maps API key — same project is fine).

1.2. **APIs & Services → OAuth consent screen**
- User type: **External**
- App name: `Villie`
- User support email: your email
- App logo: optional but nice
- Application home page: `https://villieapp.com`
- Authorized domains: add `villieapp.com` and `supabase.co`
- Developer contact: your email
- Scopes: keep the default `openid`, `userinfo.email`, `userinfo.profile`
- Test users: add your own email + your wife's email so you can test before going public
- Save & continue through to **Back to Dashboard**

1.3. **APIs & Services → Credentials → Create credentials → OAuth client ID**

Create **two** credentials — both needed:

  **(a) iOS application**
  - Application type: **iOS**
  - Name: `Villie iOS`
  - Bundle ID: `com.villieapp.mobile`
  - Save. Copy the **iOS client ID** (looks like `1234.apps.googleusercontent.com`).
  - Click on the credential to view it again — there's also a **iOS URL scheme** field that's the reversed client ID (looks like `com.googleusercontent.apps.1234`). Copy that too.

  **(b) Web application** — used by Supabase to verify ID tokens
  - Application type: **Web application**
  - Name: `Villie Web (for Supabase)`
  - Authorized redirect URIs: `https://albyndcruwopulazvpjs.supabase.co/auth/v1/callback`
  - Save. Copy the **web client ID** AND the **client secret** (Supabase needs both).

1.4. Save these four values somewhere private (not in chat):
- `GOOGLE_IOS_CLIENT_ID` — from (a)
- `GOOGLE_IOS_REVERSED_CLIENT_ID` — from (a)
- `GOOGLE_WEB_CLIENT_ID` — from (b)
- `GOOGLE_WEB_CLIENT_SECRET` — from (b)

### Step 2 — Apple Developer (~15 min, requires paid account)

> If you don't have a paid Apple Developer Program account ($99/yr), you'll need to enroll first at https://developer.apple.com/programs/. Approval is usually instant for individuals.

2.1. **Certificates, Identifiers & Profiles → Identifiers**
- Find or create the App ID for bundle `com.villieapp.mobile`
- Edit it → scroll to **Capabilities** → check **Sign In with Apple** → save

2.2. **Identifiers → +** → create a new **Services ID**
- Description: `Villie Auth Service`
- Identifier: `com.villieapp.mobile.auth` (this is the Services ID Supabase uses; the suffix is convention but any unique reverse-DNS works)
- Save → click into the created Services ID → enable **Sign In with Apple** → click **Configure**:
  - Primary App ID: `com.villieapp.mobile`
  - Domains: `albyndcruwopulazvpjs.supabase.co`
  - Return URLs: `https://albyndcruwopulazvpjs.supabase.co/auth/v1/callback`
  - Save

2.3. **Keys → +** → create a new key
- Key Name: `Villie Sign In With Apple`
- Check **Sign In with Apple** → click **Configure** → primary App ID `com.villieapp.mobile` → save
- Register → **Download the .p8 file**. Apple shows it once; save it locally as `villie-apple-signin-key.p8`. Note the **Key ID** shown on the same page.

2.4. Find your **Team ID** (top right of the Apple Developer portal, looks like `ABCD123456`).

2.5. Save these four values somewhere private:
- `APPLE_TEAM_ID` — from 2.4
- `APPLE_SERVICES_ID` — from 2.2 (e.g. `com.villieapp.mobile.auth`)
- `APPLE_KEY_ID` — from 2.3
- `APPLE_KEY_P8_CONTENTS` — the contents of the `.p8` file (open in any text editor; starts with `-----BEGIN PRIVATE KEY-----`)

### Step 3 — Supabase Auth providers (~5 min)

3.1. Open https://supabase.com/dashboard/project/albyndcruwopulazvpjs/auth/providers

3.2. Find **Google** in the list → enable it
- Client ID (for OAuth): paste `GOOGLE_WEB_CLIENT_ID` from step 1.4
- Client Secret (for OAuth): paste `GOOGLE_WEB_CLIENT_SECRET` from step 1.4
- Authorized Client IDs: paste `GOOGLE_IOS_CLIENT_ID` from step 1.4 (this is what allows the iOS-native flow's ID token to validate; without it Supabase will reject iOS tokens even with the web credentials correct)
- Skip nonce checks: leave **OFF** (defensible default)
- Save

3.3. Find **Apple** in the list → enable it
- Client ID (for OAuth): paste `APPLE_SERVICES_ID` from step 2.5
- Authorized Client IDs: paste `APPLE_SERVICES_ID` AND the App ID `com.villieapp.mobile` (comma-separated). Both are needed because the iOS-native Apple Sign-In returns tokens with `aud` claim = the App ID, while the web OAuth flow uses the Services ID.
- Apple's Secret Key (for OAuth): leave blank if Supabase auto-generates from the .p8 below. Some versions of the dashboard want a precomputed JWT here — if so, see the bottom of this doc.
- Team ID: paste `APPLE_TEAM_ID`
- Key ID: paste `APPLE_KEY_ID`
- Secret Key (.p8 file): paste `APPLE_KEY_P8_CONTENTS` (including the `-----BEGIN/END PRIVATE KEY-----` lines)
- Save

### Step 4 — Mobile env vars + iosUrlScheme (~3 min)

4.1. Open `apps/mobile/app.json` → find the `@react-native-google-signin/google-signin` plugin block → replace the placeholder `com.googleusercontent.apps.REPLACE-BEFORE-NATIVE-BUILD` with the actual reversed client ID from step 1.4 (`com.googleusercontent.apps.1234...`). This is the URL scheme iOS uses to handshake back into the app after Google's auth sheet completes. The placeholder is syntactically valid (so Metro starts without an error today) but will cause the Google sign-in deeplink to silently fail at runtime if you forget to replace it.

4.2. Add these to the environment. For **development**: edit `apps/mobile/.env` (create if missing) with:
```
EXPO_PUBLIC_OAUTH_PROVIDERS_ENABLED=1
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<GOOGLE_WEB_CLIENT_ID from 1.4>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<GOOGLE_IOS_CLIENT_ID from 1.4>
```

For **production builds** (EAS or local archive): set the same three as build-time env vars in your EAS config or build environment. Don't commit `.env` to git.

### Step 5 — Native rebuild

Because `app.json` plugins changed, Expo needs a new native build:

```
cd /Users/gp/The\ Village\ App/village-app/apps/mobile
pnpm install                # picks up the new packages from the lockfile
pnpm ios                    # expo run:ios → builds + installs on the simulator
```

> Heads-up: the earlier `pod install` failure was a Ruby 4.0.3 / CocoaPods 1.16 encoding issue with paths containing spaces. If it fails again, try `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pnpm ios`. If that still fails, the workaround is to install `cocoapods` via Bundler with a Gemfile pinned to Ruby 3.2.

### Step 6 — Smoke test (~5 min)

In the simulator:
1. Sign out if signed in
2. The Login screen now shows "or" divider + "Sign in with Apple" button (native) + "Continue with Google" button
3. Tap Apple → Apple's sheet appears → sign in with your Apple ID → returns to app authenticated
4. Sign out, then on the SignUp screen, tap Google → Google's sheet appears → pick account → returns to app authenticated, lands on OnboardingProfile
5. Check `auth.users` in Supabase to confirm both providers appear (`provider` column shows `google` and `apple`)
6. Check `public.users` was populated for both (the `on_auth_user_created` trigger should have fired)

If anything fails, the error message in the alert tells you which side broke (Google config, Apple config, or Supabase verification).

## Apple's `client_secret` JWT generation

If Supabase's Apple provider config asks for a precomputed `client_secret` JWT (instead of accepting the raw .p8), generate it with this Python one-liner (requires `pip install pyjwt[crypto]`):

```python
import jwt, time
team_id = 'YOUR_APPLE_TEAM_ID'
client_id = 'com.villieapp.mobile.auth'   # Services ID
key_id = 'YOUR_APPLE_KEY_ID'
private_key = open('villie-apple-signin-key.p8').read()
print(jwt.encode(
  {'iss': team_id, 'iat': int(time.time()), 'exp': int(time.time()) + 86400*180,
   'aud': 'https://appleid.apple.com', 'sub': client_id},
  private_key, algorithm='ES256', headers={'kid': key_id, 'alg': 'ES256'}
))
```

The JWT expires every 180 days. Set a calendar reminder or rotate via a Supabase cron.

## What to do when something breaks

- **Apple button doesn't appear**: check `isAppleSignInAvailable()` — on iOS Simulator iOS 13+ should return true. If false, sim doesn't have an Apple ID signed in (Settings → Sign in to your iPhone).
- **Google button bounces to Safari and back with no session**: the iOS URL scheme in `app.json` doesn't match the reversed client ID. Re-check step 4.1.
- **Supabase returns "invalid_grant" or "audience mismatch"**: the `aud` claim in the ID token doesn't match what Supabase has in Authorized Client IDs. Add the missing ID to step 3.2 or 3.3.
- **Apple "invalid_client"**: the Services ID, Team ID, Key ID, or .p8 contents don't match. Most common: pasted only the base64 body of the .p8 without the `-----BEGIN/END PRIVATE KEY-----` lines.

## Cross-references

- `apps/mobile/src/lib/oauth.ts` — provider helpers
- `apps/mobile/src/components/auth/OAuthButtons.tsx` — UI
- `apps/mobile/src/screens/auth/LoginScreen.tsx` + `SignUpScreen.tsx` — integration points
- `apps/mobile/app.json` — plugin config
- `apps/mobile/App.tsx` — boot-time `configureGoogleSignIn()` call
- Supabase trigger `on_auth_user_created` (migration 044) — populates `public.users` from `auth.users` regardless of provider
