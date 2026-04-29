// Edge Function: calendly-webhook
// Receives Calendly invitee.created / invitee.canceled webhooks
// POST /functions/v1/calendly-webhook
// Upserts appointments table from Calendly events

import { createClient } from 'npm:@supabase/supabase-js';
import { createHmac } from 'node:crypto';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const WEBHOOK_SECRET = Deno.env.get('CALENDLY_WEBHOOK_SECRET') ?? '';

function verifySignature(payload: string, sigHeader: string): boolean {
  if (!WEBHOOK_SECRET) return true; // Skip in local dev
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  return sigHeader === `sha256=${expected}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get('Calendly-Webhook-Signature') ?? '';

  if (!verifySignature(rawBody, sig)) {
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
