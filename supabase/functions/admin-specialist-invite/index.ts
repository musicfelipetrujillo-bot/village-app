// Edge Function: admin-specialist-invite
//
// JWT-gated wrapper around specialist-invite-create — lets the mobile
// app issue specialist invites without ever holding the service-role
// key. The user JWT is verified, then the caller's user_id is checked
// against the `ADMIN_USER_IDS` allowlist env var (comma-separated
// UUIDs). Approved callers' requests are forwarded to specialist-
// invite-create with the service-role key from this server's
// environment.
//
// POST /functions/v1/admin-specialist-invite
// Headers: Authorization: Bearer <user JWT>
// Body: { email, full_name?, credentials?, specialty?, npi_number?, personal_note? }
//
// Returns:
//   200 — { invite_id, token, invite_url, expires_at, reused }
//   401 — missing or invalid JWT
//   403 — JWT valid but caller user_id not in ADMIN_USER_IDS
//   4xx/5xx — forwarded from specialist-invite-create
//
// Configuration:
//   ADMIN_USER_IDS must be set in Edge Function Secrets — comma-separated
//   list of user UUIDs allowed to issue invites. Empty / missing → all
//   callers rejected with 403. The function never reads any other DB row
//   for the auth decision; the env var IS the allowlist.
//
// Why this exists separately from specialist-invite-create:
//   The CLI script (`pnpm specialist:invite`) keeps calling specialist-
//   invite-create with the raw service-role key because that path is
//   only used from a trusted dev machine. The mobile app can't hold
//   the service-role key safely, so it goes through this auth-aware
//   wrapper instead.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function parseAdminIds(): Set<string> {
  const raw = Deno.env.get('ADMIN_USER_IDS') ?? '';
  return new Set(
    raw.split(',').map((s) => s.trim()).filter(Boolean),
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // 1. Verify user JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'auth required' }, 401);
  }
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse({ error: 'invalid session' }, 401);
  }

  // 2. Allowlist check
  const allow = parseAdminIds();
  if (!allow.has(user.id)) {
    // Identical surface to non-admin to avoid leaking the allowlist
    return jsonResponse({ error: 'forbidden' }, 403);
  }

  // 3. Forward to specialist-invite-create with the service role key
  let bodyText: string;
  try { bodyText = await req.text(); }
  catch { return jsonResponse({ error: 'invalid body' }, 400); }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const inner = await fetch(
    `${supabaseUrl}/functions/v1/specialist-invite-create`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: bodyText,
    },
  );
  const innerBody = await inner.text();
  return new Response(innerBody, {
    status: inner.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
