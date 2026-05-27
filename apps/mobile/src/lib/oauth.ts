// V1 Auth · OAuth provider helpers (Google + Apple Sign In).
//
// Both providers feed into Supabase's `signInWithIdToken()` — the native SDK
// produces an ID token (a JWT signed by Google or Apple), and Supabase
// verifies that token against the provider's public keys. On success,
// Supabase creates or updates the auth.users row, and our existing
// `on_auth_user_created` trigger (migration 044) populates the
// public.users mirror.
//
// Feature flag: EXPO_PUBLIC_OAUTH_PROVIDERS_ENABLED. When '0' / unset, the
// button component returns null so this code path is dormant. When '1',
// the buttons render and these functions wire up against the native SDKs.
//
// Dashboard prerequisites (must be done BEFORE flipping the flag):
//   1. Google Cloud Console → OAuth 2.0 Client IDs (iOS + Web)
//   2. Apple Developer → Sign In with Apple capability + Services ID + Key
//   3. Supabase Auth → enable Google + Apple providers, paste credentials
// See village-app/docs/AUTH_PROVIDER_SETUP.md for the click-by-click.
//
// Platform notes:
//   - Apple Sign In is iOS-only via the native SDK. On Android we either
//     skip the button (current approach) or fall back to OAuth web flow.
//   - Apple's App Store guideline 4.8 requires Sign In with Apple ALONGSIDE
//     any third-party login. So Google + Apple ship together, not Google
//     alone. (See docs/AUTH_PROVIDER_SETUP.md for the binding decision.)
import { Platform } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

export const OAUTH_PROVIDERS_ENABLED =
  process.env.EXPO_PUBLIC_OAUTH_PROVIDERS_ENABLED === '1';

// ─────────────────────────────────────────────────────────────────────────────
// Google
// ─────────────────────────────────────────────────────────────────────────────

// Configure once at app launch. Calls are cheap and idempotent. The IDs
// come from Google Cloud Console (see AUTH_PROVIDER_SETUP.md §1).
//
// EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is the WEB client ID used by Supabase to
// verify the token. EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is the iOS-native one
// used by the SDK to drive the sign-in sheet.
export function configureGoogleSignIn() {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!webClientId) {
    // Don't blow up at boot if the dashboards aren't configured yet —
    // OAUTH_PROVIDERS_ENABLED gates visibility, this is just defensive.
    if (OAUTH_PROVIDERS_ENABLED) {
      console.warn('[oauth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not set; Google sign-in will fail');
    }
    return;
  }
  GoogleSignin.configure({
    webClientId,
    iosClientId,
    // offlineAccess MUST be true to populate `serverAuthCode` in the signIn
    // response. We exchange that code server-side (see auth-google-exchange
    // edge function) for a nonce-free id_token — necessary because the
    // iOS-native flow's id_token has a PKCE nonce claim that Supabase can't
    // verify without the raw nonce (which the SDK doesn't expose).
    offlineAccess: true,
    scopes: ['email', 'profile'],
  });
}

export async function signInWithGoogle(): Promise<{
  ok: boolean;
  cancelled?: boolean;
  error?: string;
}> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    // SDK v13+ wraps the payload in .data; v11/12 returns it flat.
    const serverAuthCode = (result as any).serverAuthCode ?? (result as any).data?.serverAuthCode;
    if (!serverAuthCode) {
      // Could mean offlineAccess wasn't true at configure time, or the user
      // already authorized on a previous attempt and Google withheld the code.
      // Either way the only safe fallback is to ask the user to sign in again.
      return { ok: false, error: 'No server auth code returned from Google' };
    }

    // Exchange the serverAuthCode for a fresh nonce-free id_token via our
    // edge function. The function uses the WEB client secret (server-side
    // only) to call Google's token endpoint. The exchanged id_token is
    // signed against the web client and is safe for Supabase to verify
    // because the server-side OAuth code-exchange flow doesn't add a PKCE
    // nonce claim.
    const { data: exchangeData, error: exchangeError } = await supabase.functions.invoke(
      'auth-google-exchange',
      { body: { serverAuthCode } },
    );
    if (exchangeError) {
      return { ok: false, error: exchangeError.message ?? 'Google token exchange failed' };
    }
    if (exchangeData?.error) {
      return { ok: false, error: String(exchangeData.error) };
    }
    const idToken = exchangeData?.id_token;
    if (typeof idToken !== 'string' || idToken.length === 0) {
      return { ok: false, error: 'No ID token returned from Google exchange' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    if (err?.code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false, cancelled: true };
    }
    if (err?.code === statusCodes.IN_PROGRESS) {
      return { ok: false, error: 'A sign-in is already in progress.' };
    }
    if (err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { ok: false, error: 'Google Play Services is not available.' };
    }
    return { ok: false, error: err?.message ?? 'Google sign-in failed.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Apple
// ─────────────────────────────────────────────────────────────────────────────

/** True iff this device can natively present the Apple Sign In sheet. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<{
  ok: boolean;
  cancelled?: boolean;
  error?: string;
}> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      return { ok: false, error: 'No identity token returned from Apple' };
    }
    // Pass the nonce only if expo-apple-authentication generated one — older
    // versions don't expose it; Supabase still accepts the token without
    // nonce verification.
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    // Apple's SDK throws ERR_REQUEST_CANCELED on user cancel.
    if (err?.code === 'ERR_REQUEST_CANCELED') {
      return { ok: false, cancelled: true };
    }
    return { ok: false, error: err?.message ?? 'Apple sign-in failed.' };
  }
}
