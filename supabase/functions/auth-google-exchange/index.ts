// V1 Auth · Google Sign-In serverAuthCode → fresh id_token exchange.
// POST /functions/v1/auth-google-exchange
//
// Body: { serverAuthCode: string }
//
// WHY THIS FUNCTION EXISTS:
//
// @react-native-google-signin/google-signin v16 on iOS uses GIDSignIn 7.x,
// which auto-generates a PKCE nonce that the library never exposes to JS.
// The resulting id_token has a `nonce` claim. Supabase's signInWithIdToken
// expects either NO nonce in the token OR a matching nonce param so it can
// verify SHA256(param) == token.nonce. Since we never see the raw nonce,
// that check always fails — error "Passed nonce and nonce in id_token
// should either both exist or not."
//
// Workaround: use the OAuth `serverAuthCode` (only populated when
// `offlineAccess: true` is set in GoogleSignin.configure()) and exchange
// it server-side at Google's token endpoint. The exchanged id_token is
// signed against the WEB client ID and does NOT include a nonce claim —
// because this is the standard server-side OAuth code-exchange flow,
// not the iOS-native PKCE flow.
//
// The mobile client then signs in to Supabase with this fresh id_token,
// passing nothing else. GoTrue sees no nonce claim, no nonce param → ✅.
//
// REQUIRED SUPABASE SECRETS:
//   GOOGLE_WEB_CLIENT_ID     — e.g. 595113218342-9k6...apps.googleusercontent.com
//                              (already known; this is the WEB client, not iOS)
//   GOOGLE_WEB_CLIENT_SECRET — paired secret from Google Cloud Console,
//                              "Villie Web (for Supabase)" client → Client secrets.
//                              Use either of the two existing secrets (KIQE
//                              or f_JZ) — whichever is current. Drop the older
//                              one in Google Cloud once verified.
//
// FAILURE MODES:
//   - GOOGLE_WEB_CLIENT_SECRET unset → 500 with `{error:'no_client_secret'}`
//   - serverAuthCode missing/empty → 400
//   - Google returns invalid_grant (code expired / reused) → 400 with the
//     literal Google error so the client can prompt a fresh sign-in
//   - Network failure to Google → 500
//
// SECURITY POSTURE:
//   - No JWT required on the caller — this is part of the SIGN-IN flow,
//     so the user has no Supabase session yet. The auth code itself is
//     the proof (one-time-use, short-lived).
//   - The client secret never leaves Supabase Secrets. Mobile never sees it.
//   - We do NOT return the access_token to the client; only the id_token
//     (which is what Supabase consumes). Refresh tokens stay server-side.

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const clientId = Deno.env.get('GOOGLE_WEB_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_WEB_CLIENT_SECRET');
  if (!clientId) return json({ error: 'no_client_id' }, 500);
  if (!clientSecret) return json({ error: 'no_client_secret' }, 500);

  let body: { serverAuthCode?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const serverAuthCode = typeof body?.serverAuthCode === 'string' ? body.serverAuthCode.trim() : '';
  if (!serverAuthCode) {
    return json({ error: 'missing_server_auth_code' }, 400);
  }

  try {
    // Google's token endpoint expects application/x-www-form-urlencoded.
    // The `redirect_uri` is empty for iOS native-flow code exchange —
    // GIDSignIn doesn't use a redirect URI for the iOS app, only PKCE.
    // (Some Google SDK code paths require literal '' string here; Google
    // accepts empty fine.)
    const params = new URLSearchParams({
      code: serverAuthCode,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: '',
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Surface Google's structured error so the client can decide whether
      // to retry sign-in (invalid_grant typically means the code was
      // already consumed; a fresh GoogleSignin.signIn() call fixes it).
      console.warn('Google token exchange failed:', res.status, data);
      return json(
        {
          error: 'google_token_exchange_failed',
          status: res.status,
          google_error: data?.error ?? 'unknown',
          google_error_description: data?.error_description ?? null,
        },
        400,
      );
    }

    const idToken = data?.id_token;
    if (typeof idToken !== 'string' || idToken.length === 0) {
      console.error('Google response missing id_token:', data);
      return json({ error: 'no_id_token_in_response' }, 500);
    }

    // Return ONLY the id_token. Access token and refresh token stay
    // server-side for any future server-side Google API needs; mobile
    // doesn't need them for the Supabase sign-in flow.
    return json({ ok: true, id_token: idToken });
  } catch (err) {
    console.error('auth-google-exchange fatal:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
