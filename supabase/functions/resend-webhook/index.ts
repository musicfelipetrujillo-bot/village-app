// resend-webhook — receives Resend email-event webhooks (opens, clicks,
// bounces, complaints) and updates newsletter_sends for engagement
// tracking. Migration 067 reserved the opened_at / first_click_at /
// click_count columns on newsletter_sends for exactly this hookup.
//
// Resend uses Svix for webhook signing. Every request carries three
// headers:
//   svix-id         — unique message id (used for idempotency)
//   svix-timestamp  — UNIX seconds when Resend sent the request
//   svix-signature  — base64 HMAC-SHA256(<id>.<ts>.<rawBody>) over the
//                     webhook secret. Multiple signatures can be present
//                     (rotating secrets); we accept if any verifies.
//
// Verification spec: https://docs.resend.com/api-reference/webhooks/verify-webhook-events
//
// Configure in the Resend dashboard:
//   1. Go to https://resend.com → Webhooks → Add endpoint
//   2. Endpoint URL: https://albyndcruwopulazvpjs.supabase.co/functions/v1/resend-webhook
//   3. Subscribe to: email.delivered, email.opened, email.clicked,
//                    email.bounced, email.complained, email.delivery_delayed
//   4. Copy the "Signing Secret" (starts with `whsec_`)
//   5. Set as RESEND_WEBHOOK_SECRET in Supabase → Edge Functions → Secrets
//   6. Hit "Send test event" from the Resend dashboard to verify
//
// Deploy: supabase functions deploy resend-webhook --no-verify-jwt
//   (no JWT because Resend can't send Supabase service-role bearer; we
//    rely on the Svix signature for auth.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SVIX_SECRET_RAW  = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';

// The secret comes from Resend in the form `whsec_<base64>`. Strip the
// prefix once at boot; the actual HMAC key is the base64-decoded blob.
const SVIX_SECRET_KEY: Uint8Array | null = (() => {
  if (!SVIX_SECRET_RAW) return null;
  try {
    const b64 = SVIX_SECRET_RAW.startsWith('whsec_')
      ? SVIX_SECRET_RAW.slice('whsec_'.length)
      : SVIX_SECRET_RAW;
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  } catch {
    return null;
  }
})();

// Constant-time compare for two equal-length byte arrays. Stock !== on
// strings/Uint8Arrays is fine semantically but leaks length-dependent
// timing — auth verification is one of the few places that genuinely
// matters.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifySvix(req: Request, rawBody: string): Promise<boolean> {
  if (!SVIX_SECRET_KEY) return false; // secret unconfigured → reject all
  const id  = req.headers.get('svix-id');
  const ts  = req.headers.get('svix-timestamp');
  const sigHeader = req.headers.get('svix-signature');
  if (!id || !ts || !sigHeader) return false;

  // Replay-attack guard: reject anything older than 5 minutes.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const ageMs = Math.abs(Date.now() - tsNum * 1000);
  if (ageMs > 5 * 60 * 1000) return false;

  // Compute the expected HMAC.
  const payload = `${id}.${ts}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw', SVIX_SECRET_KEY, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const expectedBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = new Uint8Array(expectedBuf);

  // Header format: "v1,<base64sig> v1,<base64sig> ..." (space-separated;
  // Resend may rotate secrets and send multiple sigs). Any match wins.
  const candidates = sigHeader.split(' ').map(s => s.trim()).filter(Boolean);
  for (const c of candidates) {
    const [version, b64] = c.split(',');
    if (version !== 'v1' || !b64) continue;
    try {
      const bin = atob(b64);
      const sig = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) sig[i] = bin.charCodeAt(i);
      if (timingSafeEqual(sig, expected)) return true;
    } catch {
      // ignore parse errors on individual candidates
    }
  }
  return false;
}

interface ResendEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    from?: string;
    bounce_type?: string; // 'hard' | 'soft'
    click?: { link?: string };
  };
}

async function handleEvent(ev: ResendEvent): Promise<{ ok: boolean; reason?: string }> {
  const messageId = ev?.data?.email_id;
  if (!messageId) return { ok: true, reason: 'no_email_id' };

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  switch (ev.type) {
    case 'email.opened': {
      // First-open only — don't overwrite if already set, so the
      // timestamp reflects when the recipient FIRST opened the digest
      // (the data we actually care about for engagement curves).
      const { error } = await supabase
        .from('newsletter_sends')
        .update({ opened_at: new Date().toISOString() })
        .eq('resend_id', messageId)
        .is('opened_at', null);
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }
    case 'email.clicked': {
      // Two updates in sequence (no transaction needed — the second is
      // an additive increment):
      //   1. set first_click_at if NULL
      //   2. increment click_count
      // We do a select-then-update for first_click_at because the
      // .update().is('first_click_at', null) shortcut returns no error
      // when the row already exists but no-ops silently; that's the
      // desired behavior.
      const nowIso = new Date().toISOString();
      await supabase
        .from('newsletter_sends')
        .update({ first_click_at: nowIso })
        .eq('resend_id', messageId)
        .is('first_click_at', null);

      // Increment click_count. supabase-js has no atomic increment, so
      // we do a 2-step read-modify-write. Concurrent clicks on the same
      // email are rare enough that a lost increment is acceptable; if it
      // ever matters we can wrap this in an RPC.
      const { data: row } = await supabase
        .from('newsletter_sends')
        .select('click_count')
        .eq('resend_id', messageId)
        .maybeSingle();
      if (row) {
        await supabase
          .from('newsletter_sends')
          .update({ click_count: (row.click_count ?? 0) + 1 })
          .eq('resend_id', messageId);
      }
      return { ok: true };
    }
    case 'email.bounced':
    case 'email.complained': {
      // Both are CAN-SPAM concerns — a bounce or spam-complaint user
      // should NOT receive next week's send. We don't auto-toggle their
      // notif_prefs.newsletter (could be a transient soft bounce), but
      // we log it for the next moderator audit. The newsletter cron
      // RPC already excludes users whose email is unconfirmed; future
      // refinement: also exclude users with N recent bounces.
      const { data: send } = await supabase
        .from('newsletter_sends')
        .select('user_id, period_start')
        .eq('resend_id', messageId)
        .maybeSingle();
      // Best-effort audit log; ignore failures.
      try {
        await supabase.from('admin_audit_log').insert({
          action: ev.type === 'email.bounced' ? 'newsletter_bounce' : 'newsletter_complaint',
          metadata: {
            resend_id: messageId,
            user_id: send?.user_id ?? null,
            period_start: send?.period_start ?? null,
            bounce_type: ev?.data?.bounce_type ?? null,
            created_at: ev.created_at ?? null,
          },
        });
      } catch {
        // ignore
      }
      return { ok: true };
    }
    // Acknowledge but don't mutate state. Resend retries on non-2xx
    // responses; returning 200 for "I don't care about this event" is
    // intentional and stops the retry storm.
    case 'email.sent':
    case 'email.delivered':
    case 'email.delivery_delayed':
      return { ok: true };
    default:
      return { ok: true, reason: 'unhandled_event_type' };
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  // Read raw body BEFORE parsing — Svix signs the exact bytes that
  // arrived, including whitespace and JSON formatting quirks.
  const rawBody = await req.text();
  const verified = await verifySvix(req, rawBody);
  if (!verified) {
    return new Response(JSON.stringify({ error: 'invalid signature' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  let ev: ResendEvent;
  try {
    ev = JSON.parse(rawBody);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  const result = await handleEvent(ev);
  // Always 200 unless verification failed. If our handler errors, log
  // and acknowledge — re-driving from Resend's retry queue rarely fixes
  // a downstream DB issue, and a 5xx blocks all subsequent webhooks.
  if (!result.ok) {
    console.warn('resend-webhook handler error', result.reason, 'type=', ev.type);
  }
  return new Response(JSON.stringify({ ok: true, type: ev.type }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});
