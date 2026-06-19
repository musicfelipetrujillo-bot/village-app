// Edge Function: stripe-webhook
//
// Receives Stripe webhook events and reconciles them with our DB. Today it
// handles the Villie Boxes order lifecycle (the first in-app physical-goods
// flow); specialist bookings persist their row client-side after capture and
// don't need a webhook, so they are intentionally ignored here.
//
// Boxes events (matched on PaymentIntent metadata.kind === 'villie_box'):
//   payment_intent.succeeded       → order.status = 'paid',     paid_at = now()
//   payment_intent.payment_failed  → order.status = 'cancelled' (still pending only)
//   charge.refunded                → order.status = 'refunded'
//
// SECURITY: every request is signature-verified against STRIPE_WEBHOOK_SECRET
// using the raw request body (constructEventAsync + SubtleCrypto provider —
// Deno has no Node crypto, so the async/Subtle path is required). An invalid
// or missing signature is rejected 400 before any DB work.
//
// Setup: in the Stripe Dashboard add an endpoint pointing at this function's
// URL, subscribe to the three event types above, and drop the signing secret
// into Supabase Edge Function Secrets as STRIPE_WEBHOOK_SECRET.

import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

function service() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// Flip a boxes order by its PaymentIntent id. `guardPending` limits the
// transition to rows still in 'pending_payment' so a late/duplicate failure
// event can't clobber an already-paid order.
async function setOrderStatus(
  paymentIntentId: string,
  status: 'paid' | 'cancelled' | 'refunded',
  opts: { paidAt?: boolean; guardPending?: boolean } = {},
): Promise<void> {
  const db = service();
  const patch: Record<string, unknown> = { status };
  if (opts.paidAt) patch.paid_at = new Date().toISOString();

  let q = db
    .from('villie_box_orders')
    .update(patch)
    .eq('stripe_payment_intent_id', paymentIntentId);
  if (opts.guardPending) q = q.eq('status', 'pending_payment');

  const { error } = await q;
  if (error) console.error(`stripe-webhook: failed to set ${status} for ${paymentIntentId}:`, error.message);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig || !WEBHOOK_SECRET) {
    return new Response('Missing signature or secret', { status: 400 });
  }

  // Raw body is required for signature verification — read it once as text.
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'bad signature';
    console.error('stripe-webhook: signature verification failed:', msg);
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.kind === 'villie_box') {
          await setOrderStatus(pi.id, 'paid', { paidAt: true });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.kind === 'villie_box') {
          // Only cancel if still unpaid — never downgrade a paid order.
          await setOrderStatus(pi.id, 'cancelled', { guardPending: true });
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const piId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
        // Charge metadata doesn't carry our kind; gate the update on a matching
        // order row instead (the .eq on stripe_payment_intent_id is the filter).
        if (piId) {
          await setOrderStatus(piId, 'refunded');
        }
        break;
      }
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'handler error';
    console.error('stripe-webhook: handler error:', msg);
    // 500 → Stripe retries with backoff (the handler is idempotent).
    return new Response(`Handler error: ${msg}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
