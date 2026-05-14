// Edge Function: specialist-invite-create
// POST /functions/v1/specialist-invite-create
//
// Admin tool — issue a new specialist invite.
//
// Auth:
//   Must be called with the SUPABASE_SERVICE_ROLE_KEY as the bearer token.
//   This is admin-only — never callable from mobile or from the web app.
//
// Body (JSON):
//   {
//     email:          string                 // required, lowercased server-side
//     full_name?:     string                 // optional pre-fill
//     credentials?:   string                 // optional pre-fill (e.g. "MD", "IBCLC")
//     specialty?:     SpecialtyType          // optional pre-fill (allowlist)
//     npi_number?:    string                 // optional pre-fill
//     personal_note?: string                 // optional, ≤500 chars, shown in email
//   }
//
// Behaviour:
//   1. Validates email shape + specialty enum.
//   2. Idempotent on email: if a non-expired, non-revoked, non-used invite
//      exists for the same email, returns that invite's URL instead of
//      issuing a duplicate. Caller can revoke + re-invite explicitly.
//   3. Generates a 36-char URL-safe token via crypto.randomUUID().
//   4. Inserts a specialist_invites row.
//   5. Logs the invite details (mocked email — real Resend wire-up is the
//      next step in the build sequence). Returns the invite URL so the
//      admin can hand-deliver if needed.
//
// Returns (200):
//   { invite_id, token, invite_url, expires_at, reused: boolean }
//
// Errors:
//   400 — malformed body / invalid email / invalid specialty
//   403 — wrong / missing auth
//   500 — DB error

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mirror of the migration 060 specialty CHECK. Keep in lockstep with
// `specialists.specialty` (migration 001) — if either grows, update both.
const ALLOWED_SPECIALTIES = new Set([
  'ob_gyn', 'midwife', 'doula', 'lactation_consultant', 'pediatrician',
  'sleep_coach', 'pelvic_floor_pt', 'perinatal_dietitian', 'ppd_therapist',
]);

// Same regex as the DB CHECK — defense in depth.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Base for the static onboarding page. Override via WEB_ONBOARD_URL_BASE
// secret when the production domain is set up.
const ONBOARD_BASE = Deno.env.get('WEB_ONBOARD_URL_BASE') ?? 'https://villieapp.com/onboard';

// ─── Resend integration ────────────────────────────────────────────────
// Email is sent via Resend (https://resend.com). Required secrets:
//   - RESEND_API_KEY        — API key from Resend dashboard
//   - INVITE_FROM_EMAIL     — verified sending address (e.g. invites@villieapp.com)
//   - INVITE_REPLY_TO       — optional reply-to (defaults to hello@villieapp.com)
// If RESEND_API_KEY is missing, the function gracefully falls back to
// console.log (preserving the prior dev behavior — admins copy the URL from
// the JSON response and hand-deliver).
const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY');
const INVITE_FROM     = Deno.env.get('INVITE_FROM_EMAIL') ?? 'villie <invites@villieapp.com>';
const INVITE_REPLY_TO = Deno.env.get('INVITE_REPLY_TO')   ?? 'hello@villieapp.com';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// HTML-escape a user-provided string for safe embedding in the email body.
// We pre-fill admin-supplied name / personal_note from the invite — these
// originate from an authenticated admin, but defense-in-depth still applies.
function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

// ─── Email template ────────────────────────────────────────────────────
// Brand kit v2 (villie · May 2026) applied inline. Custom fonts (Caprasimo,
// Playfair, Plus Jakarta) won't load in most mail clients — we declare them
// in font-family with serif/sans fallbacks so deliverability stays clean.
// The wordmark is rendered as Caprasimo text in cinnamon — clients drop to
// system serif but the color + lowercase casing still read as the brand.
// Inline CSS only (most clients strip <style> blocks).
function buildInviteEmail(opts: {
  fullName:     string | null;
  inviteUrl:    string;
  personalNote: string | null;
  expiresAt:    string;
}): { subject: string; html: string; text: string } {
  const firstName    = opts.fullName ? opts.fullName.trim().split(/\s+/)[0] : null;
  const greeting     = firstName ? `Welcome, ${firstName}.` : 'Welcome to villie.';
  const expiresHuman = new Date(opts.expiresAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const subject = firstName
    ? `${firstName}, your villie specialist invite`
    : 'Your villie specialist invite';

  // ─── Plain-text fallback (for clients that prefer it / accessibility) ───
  const text = [
    greeting,
    '',
    "You've been invited to join villie — a maternal-health platform built around the postpartum window.",
    "Set up your specialist profile here:",
    opts.inviteUrl,
    '',
    opts.personalNote ? `Note from us:\n${opts.personalNote}\n` : '',
    `This invite expires ${expiresHuman}.`,
    '',
    'Questions? Reply to this email — it goes straight to us.',
    '— the villie team',
  ].filter(Boolean).join('\n');

  // ─── HTML body ───
  // Inline styles only. 600px content max-width — the email-design convention.
  const html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F4ECD8;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;color:#3D1F0E;line-height:1.5;-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4ECD8;">
    <tr>
      <td align="center" style="padding:32px 16px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">

          <!-- Wordmark — Caprasimo cinnamon, lowercase. Falls back to system
               serif in clients that don't load custom fonts; the color and
               weight still read on-brand. -->
          <tr>
            <td align="left" style="padding:0 8px 8px;">
              <div style="font-family:'Caprasimo',Georgia,'Times New Roman',serif;font-weight:400;font-size:44px;line-height:1;letter-spacing:-0.02em;color:#C07840;">villie</div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="padding:8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FEFAF6;border-radius:16px;border:1px solid rgba(122,74,40,0.12);">
                <tr>
                  <td style="padding:36px 32px 28px;">

                    <!-- Eyebrow -->
                    <div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:11px;letter-spacing:0.26em;text-transform:uppercase;color:#A77349;margin:0 0 16px;">
                      <span style="display:inline-block;width:18px;height:1px;background:#A77349;vertical-align:middle;margin-right:9px;"></span>specialist invite
                    </div>

                    <!-- Greeting (Playfair roman 700 + italic 600 caramel name) -->
                    <h1 style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-weight:700;font-size:34px;line-height:1.05;letter-spacing:-0.6px;color:#3D1F0E;margin:0 0 14px;">
                      ${firstName
                        ? `Welcome, <em style="font-style:italic;font-weight:600;color:#D4A880;">${esc(firstName)}.</em>`
                        : `Welcome to <em style="font-style:italic;font-weight:600;color:#D4A880;">villie.</em>`}
                    </h1>

                    <!-- Lead -->
                    <p style="font-size:15px;line-height:1.55;color:#3D1F0E;opacity:0.85;margin:0 0 24px;">
                      You've been invited to join the villie specialist directory — a maternal-health platform built around the postpartum window, distributed through hospital discharge.
                    </p>

                    ${opts.personalNote ? `
                    <!-- Personal note card -->
                    <div style="background:#F4ECD8;border-radius:12px;padding:16px 18px;margin:0 0 24px;">
                      <div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:10px;letter-spacing:0.26em;text-transform:uppercase;color:#A77349;margin-bottom:6px;">a note from us</div>
                      <div style="font-size:14px;line-height:1.55;color:#3D1F0E;">${esc(opts.personalNote)}</div>
                    </div>
                    ` : ''}

                    <!-- CTA — cinnamon pill (the one spark) -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                      <tr>
                        <td align="center" style="background:#C07840;border-radius:999px;">
                          <a href="${esc(opts.inviteUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,Helvetica,sans-serif;font-weight:600;font-size:15px;color:#FEFAF6;text-decoration:none;letter-spacing:0.2px;">
                            Set up your profile →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Expiry -->
                    <p style="font-family:'JetBrains Mono','Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#A77349;margin:0 0 4px;">
                      Expires ${esc(expiresHuman)}
                    </p>
                    <p style="font-size:13px;line-height:1.55;color:#7A4A28;margin:0;">
                      Or paste this link into your browser:<br>
                      <a href="${esc(opts.inviteUrl)}" style="color:#C07840;text-decoration:underline;word-break:break-all;">${esc(opts.inviteUrl)}</a>
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 16px 8px;">
              <p style="font-size:12px;line-height:1.55;color:#7A4A28;margin:0 0 6px;">
                Questions? Reply to this email — it goes straight to us.
              </p>
              <p style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:500;font-size:14px;color:#7A4A28;margin:8px 0 0;">— the villie team</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

// Send via Resend. Returns true on 2xx, false on any failure. Failures are
// logged but never throw — invite creation must succeed even if email fails,
// because the admin can hand-deliver the URL from the JSON response.
async function sendInviteEmail(to: string, msg: { subject: string; html: string; text: string }): Promise<boolean> {
  if (!RESEND_API_KEY) {
    // Dev / pre-deploy fallback — log the email and return false.
    console.log(JSON.stringify({
      type:        'invite_email_pending_no_api_key',
      to,
      subject:     msg.subject,
      preview:     msg.text.slice(0, 200),
    }));
    return false;
  }
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     INVITE_FROM,
        to:       [to],
        reply_to: INVITE_REPLY_TO,
        subject:  msg.subject,
        html:     msg.html,
        text:     msg.text,
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error('specialist-invite-create resend error', resp.status, errBody);
      return false;
    }
    return true;
  } catch (e) {
    console.error('specialist-invite-create resend exception', e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // ─── Auth gate (service role only) ─────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return json({ error: 'Forbidden' }, 403);
  }

  // ─── Parse + validate body ─────────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const fullName = body.full_name?.trim() || null;
  const credentials = body.credentials?.trim() || null;
  const specialty = body.specialty?.trim() || null;
  const npiNumber = body.npi_number?.trim() || null;
  const personalNote = body.personal_note?.trim() || null;
  const invitedBy = body.invited_by ?? null;   // optional admin user_id

  if (!email || !EMAIL_RE.test(email)) {
    return json({ error: 'email is required and must be a valid address' }, 400);
  }
  if (specialty && !ALLOWED_SPECIALTIES.has(specialty)) {
    return json({
      error: `specialty must be one of: ${[...ALLOWED_SPECIALTIES].join(', ')}`,
    }, 400);
  }
  if (fullName && fullName.length > 120) {
    return json({ error: 'full_name max 120 chars' }, 400);
  }
  if (credentials && credentials.length > 60) {
    return json({ error: 'credentials max 60 chars' }, 400);
  }
  if (npiNumber && npiNumber.length > 20) {
    return json({ error: 'npi_number max 20 chars' }, 400);
  }
  if (personalNote && personalNote.length > 500) {
    return json({ error: 'personal_note max 500 chars' }, 400);
  }

  // ─── Refuse if specialist already exists for this email ─────────────
  // No point inviting someone who's already in the directory. Caller
  // should approve/edit their existing record instead.
  const { data: existingSpecialist } = await supabase
    .from('users')
    .select('id, specialists(id)')
    .eq('email', email)
    .maybeSingle();

  if (existingSpecialist && (existingSpecialist as any).specialists?.length) {
    return json({
      error: 'A specialist with this email already exists in the directory',
      existing_user_id: (existingSpecialist as any).id,
    }, 409);
  }

  // ─── Idempotency: return an existing alive invite for this email ────
  const { data: existingInvite } = await supabase
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
    // No email re-send on idempotent path — caller already received an
    // invite for this email. If they need a fresh send, revoke + re-invite.
    return json({
      invite_id:   existingInvite.id,
      token:       existingInvite.token,
      invite_url:  `${ONBOARD_BASE}?token=${existingInvite.token}`,
      expires_at:  existingInvite.expires_at,
      reused:      true,
      email_sent:  null,
    });
  }

  // ─── Issue a fresh invite ───────────────────────────────────────────
  const newToken = crypto.randomUUID();   // 36 chars, satisfies >=32 CHECK

  const { data: inserted, error: insertError } = await supabase
    .from('specialist_invites')
    .insert({
      email,
      full_name:      fullName,
      credentials,
      specialty,
      npi_number:     npiNumber,
      personal_note:  personalNote,
      token:          newToken,
      invited_by:     invitedBy,
    })
    .select('id, token, expires_at')
    .single();

  if (insertError || !inserted) {
    console.error('specialist-invite-create insert error', insertError);
    return json({ error: insertError?.message ?? 'Failed to create invite' }, 500);
  }

  const inviteUrl = `${ONBOARD_BASE}?token=${inserted.token}`;

  // ─── Send the invite email via Resend ───────────────────────────────
  // If RESEND_API_KEY is not configured (dev / pre-deploy), the helper
  // logs the email payload and returns false — the admin can still
  // hand-deliver the invite_url from the JSON response below.
  const emailMsg = buildInviteEmail({
    fullName,
    inviteUrl,
    personalNote,
    expiresAt: inserted.expires_at,
  });
  const emailSent = await sendInviteEmail(email, emailMsg);

  return json({
    invite_id:   inserted.id,
    token:       inserted.token,
    invite_url:  inviteUrl,
    expires_at:  inserted.expires_at,
    reused:      false,
    email_sent:  emailSent,
  });
});
