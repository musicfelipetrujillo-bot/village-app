// Edge Function: admin-specialist-invite
//
// JWT-gated mobile gateway for issuing specialist invites. The user JWT
// is verified, then the caller's user_id is checked against the
// `ADMIN_USER_IDS` allowlist env var (comma-separated UUIDs). Approved
// callers' requests are written to specialist_invites directly using
// the service-role supabase client.
//
// POST /functions/v1/admin-specialist-invite
// Headers: Authorization: Bearer <user JWT>
// Body: { email, full_name?, credentials?, specialty?, npi_number?, personal_note? }
//
// Returns:
//   200 — { invite_id, token, invite_url, expires_at, reused }
//   401 — missing or invalid JWT
//   403 — JWT valid but caller user_id not in ADMIN_USER_IDS
//   400 — invalid payload
//   500 — DB error
//
// Configuration:
//   ADMIN_USER_IDS must be set in Edge Function Secrets — comma-separated
//   list of user UUIDs allowed to issue invites. Empty / missing → all
//   callers rejected with 403. The function never reads any other DB row
//   for the auth decision; the env var IS the allowlist.
//
// Why DB writes live here vs forwarding to specialist-invite-create:
//   Edge-function-to-edge-function HTTP calls through the public gateway
//   don't reliably pass through raw service-role bearers (gateway
//   intercepts), which surfaced as 403 from the inner function. Going
//   direct via supabase-js avoids the gateway hop. The CLI script
//   (`pnpm specialist:invite`) keeps calling specialist-invite-create
//   directly with the raw service-role key because that path is only
//   used from a trusted dev shell where the gateway accepts the key.
//
// Email send is intentionally skipped here — the CLI path triggers the
// branded Resend email; the in-app admin tool just returns the URL +
// Share Sheet which is more useful for one-off invites (the admin
// hands the link over via text, Slack, or in-person).

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_SPECIALTIES = new Set([
  'ob_gyn', 'midwife', 'doula', 'lactation_consultant', 'pediatrician',
  'sleep_coach', 'pelvic_floor_pt', 'perinatal_dietitian', 'ppd_therapist',
]);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ONBOARD_BASE = Deno.env.get('WEB_ONBOARD_URL_BASE') ?? 'https://villieapp.com/onboard';

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

  // ─── 1. Verify user JWT ──────────────────────────────────────────────
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

  // ─── 2. Allowlist check ──────────────────────────────────────────────
  const allow = parseAdminIds();
  if (!allow.has(user.id)) {
    return jsonResponse({ error: 'forbidden' }, 403);
  }

  // ─── 3. Parse + validate body ────────────────────────────────────────
  let body: any;
  try { body = await req.json(); }
  catch { return jsonResponse({ error: 'invalid json' }, 400); }

  const email = String(body.email ?? '').trim().toLowerCase();
  const fullName = body.full_name?.trim() || null;
  const credentials = body.credentials?.trim() || null;
  const specialty = body.specialty?.trim() || null;
  const npiNumber = body.npi_number?.trim() || null;
  const personalNote = body.personal_note?.trim() || null;

  if (!email || !EMAIL_RE.test(email)) {
    return jsonResponse({ error: 'email is required and must be a valid address' }, 400);
  }
  if (specialty && !ALLOWED_SPECIALTIES.has(specialty)) {
    return jsonResponse({
      error: `specialty must be one of: ${[...ALLOWED_SPECIALTIES].join(', ')}`,
    }, 400);
  }
  if (fullName && fullName.length > 120) {
    return jsonResponse({ error: 'full_name max 120 chars' }, 400);
  }
  if (credentials && credentials.length > 60) {
    return jsonResponse({ error: 'credentials max 60 chars' }, 400);
  }
  if (npiNumber && npiNumber.length > 20) {
    return jsonResponse({ error: 'npi_number max 20 chars' }, 400);
  }
  if (personalNote && personalNote.length > 500) {
    return jsonResponse({ error: 'personal_note max 500 chars' }, 400);
  }

  // ─── 4. Service-role client for DB writes ────────────────────────────
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Refuse if specialist already exists for this email
  const { data: existingSpecialist } = await admin
    .from('users')
    .select('id, specialists(id)')
    .eq('email', email)
    .maybeSingle();
  if (existingSpecialist && (existingSpecialist as any).specialists?.length) {
    return jsonResponse({
      error: 'A specialist with this email already exists in the directory',
      existing_user_id: (existingSpecialist as any).id,
    }, 409);
  }

  // Idempotency: return an existing alive invite for this email
  const { data: existingInvite } = await admin
    .from('specialist_invites')
    .select('id, token, expires_at')
    .ilike('email', email)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingInvite) {
    return jsonResponse({
      invite_id:   existingInvite.id,
      token:       existingInvite.token,
      invite_url:  `${ONBOARD_BASE}?token=${existingInvite.token}`,
      expires_at:  existingInvite.expires_at,
      reused:      true,
    }, 200);
  }

  // Issue a fresh invite. Stamps invited_by = the admin's user.id for
  // the audit trail (specialist-invite-create CLI takes invited_by
  // from the optional body field; here we always know who's calling).
  const newToken = crypto.randomUUID();
  const { data: inserted, error: insertError } = await admin
    .from('specialist_invites')
    .insert({
      email,
      full_name:      fullName,
      credentials,
      specialty,
      npi_number:     npiNumber,
      personal_note:  personalNote,
      token:          newToken,
      invited_by:     user.id,
    })
    .select('id, token, expires_at')
    .single();

  if (insertError || !inserted) {
    console.error('admin-specialist-invite insert error', insertError);
    return jsonResponse({ error: insertError?.message ?? 'Failed to create invite' }, 500);
  }

  return jsonResponse({
    invite_id:   inserted.id,
    token:       inserted.token,
    invite_url:  `${ONBOARD_BASE}?token=${inserted.token}`,
    expires_at:  inserted.expires_at,
    reused:      false,
  }, 200);
});
