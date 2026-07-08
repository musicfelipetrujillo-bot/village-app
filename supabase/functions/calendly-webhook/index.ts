// Edge Function: calendly-webhook
// Receives Calendly invitee.created / invitee.canceled webhooks
// POST /functions/v1/calendly-webhook
// Upserts appointments table from Calendly events

import { createClient } from 'npm:@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const WEBHOOK_SECRET = Deno.env.get('CALENDLY_WEBHOOK_SECRET') ?? '';
const SIGNATURE_TOLERANCE_SECONDS = 300;

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Calendly signs each webhook with the header
//   Calendly-Webhook-Signature: t=<unix_seconds>,v1=<hex hmac_sha256>
// where the signed content is `${t}.${rawBody}`, HMAC-SHA256 with the subscription's
// signing key. See https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-webhook-signatures
//
// SECURITY: fail CLOSED. Previously this returned `true` when CALENDLY_WEBHOOK_SECRET was
// unset ("skip in local dev"), which made the endpoint accept ANY unsigned POST in any
// environment where the secret wasn't configured (appsec finding H, 2026-07-07). We now
// reject when the secret is missing, the header is absent/malformed, the timestamp is stale
// (replay guard), or the HMAC doesn't match.
function verifySignature(rawBody: string, sigHeader: string): { ok: boolean; reason?: string } {
  if (!WEBHOOK_SECRET) return { ok: false, reason: 'secret_not_configured' };
  if (!sigHeader) return { ok: false, reason: 'missing_signature' };

  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(',')) {
    const i = kv.indexOf('=');
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return { ok: false, reason: 'malformed_signature' };

  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' };
  }

  const expected = createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${rawBody}`).digest('hex');
  if (!timingSafeEqualStr(v1, expected)) return { ok: false, reason: 'signature_mismatch' };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get('Calendly-Webhook-Signature') ?? '';

  const verdict = verifySignature(rawBody, sig);
  if (!verdict.ok) {
    console.error(`calendly-webhook rejected: ${verdict.reason}`);
    return new Response('Invalid signature', { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody);
    const eventType: string = event.event ?? '';
    const payload = event.payload ?? {};

    if (eventType === 'invitee.created') {
      // Extract data from Calendly payload
      const calendlyEventId: string = payload.event?.uuid ?? '';
      const startTime: string = payload.event?.start_time ?? '';
      const inviteeEmail: string = payload.invitee?.email ?? '';
      const isTelehealth: boolean = payload.event?.location?.type === 'zoom' ||
        payload.event?.location?.type === 'google_meet';
      const telehealthLink: string = payload.event?.location?.join_url ?? '';

      // Look up user by email
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', inviteeEmail)
        .single();

      // Look up specialist by Calendly username from the event URI
      const eventUri: string = payload.event?.uri ?? '';
      const calendlyUsername = eventUri.split('/')[4] ?? ''; // rough parse
      const { data: specialist } = await supabase
        .from('specialists')
        .select('id')
        .eq('calendly_username', calendlyUsername)
        .single();

      if (user && specialist) {
        await supabase.from('appointments').upsert(
          {
            user_id: user.id,
            specialist_id: specialist.id,
            source: 'calendly',
            external_id: calendlyEventId,
            status: 'confirmed',
            appointment_at: startTime,
            is_telehealth: isTelehealth,
            telehealth_link: telehealthLink || null,
          },
          { onConflict: 'external_id' },
        );
      }
    }

    if (eventType === 'invitee.canceled') {
      const calendlyEventId: string = payload.event?.uuid ?? '';
      await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('external_id', calendlyEventId)
        .eq('source', 'calendly');
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
