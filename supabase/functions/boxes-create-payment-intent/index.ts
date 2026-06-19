// Edge Function: boxes-create-payment-intent
//
// Creates a Stripe PaymentIntent + a draft order for a Villie Boxes cart.
// Mirrors create-payment-intent (Specialist booking) but for first-party
// physical-goods retail sold BY Villie — no Stripe Connect, no platform fee.
//
// SECURITY: the price is ALWAYS recomputed here from the embedded catalog.
// The client cannot send an amount — it sends only WHICH box, which optional
// items it removed, and which add-ons it added (by index), plus a bundle
// flag. We recompute every cent so a tampered client can't underpay.
//
// The embedded catalog MUST stay in sync with apps/mobile/src/api/boxes.ts.
// When the catalog moves to a `villie_boxes` table, replace CATALOG with a
// DB read here and in the app.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Embedded catalog (mirror of api/boxes.ts) ────────────────────────────
// Only the numbers that affect price: per-item value `v` + `core` flag, and
// per-add-on price `p`. Names live in the app; the order_items rows store
// indices so the app can re-render the human labels.
type CatItem = { v: number; core: boolean };
type CatBox = { price: number; was: number; items: CatItem[]; addons: number[] };

const CATALOG: Record<string, CatBox> = {
  delivery: {
    price: 128, was: 159,
    items: [
      { v: 24, core: false }, { v: 22, core: true }, { v: 20, core: false },
      { v: 12, core: true }, { v: 9, core: true }, { v: 11, core: false },
      { v: 12, core: false }, { v: 14, core: false }, { v: 18, core: true },
      { v: 12, core: true }, { v: 5, core: false },
    ],
    addons: [16, 32, 18, 28],
  },
  newborn: {
    price: 164, was: 198,
    items: [
      { v: 28, core: true }, { v: 22, core: true }, { v: 26, core: false },
      { v: 14, core: false }, { v: 18, core: true }, { v: 8, core: true },
      { v: 16, core: true }, { v: 18, core: false }, { v: 10, core: false },
      { v: 12, core: false }, { v: 26, core: false },
    ],
    addons: [40, 35, 18, 24],
  },
  mama: {
    price: 96, was: 118,
    items: [
      { v: 8, core: true }, { v: 14, core: true }, { v: 12, core: true },
      { v: 9, core: true }, { v: 12, core: true }, { v: 12, core: false },
      { v: 11, core: false }, { v: 18, core: false }, { v: 7, core: false },
      { v: 9, core: false }, { v: 6, core: false },
    ],
    addons: [16, 14, 19, 22],
  },
};

const BUNDLE_DISCOUNT = 0.9; // 10% off the summed box prices

// "now" price of one box line, in whole dollars.
function lineDollars(boxId: string, removed: number[], addons: number[]): number {
  const box = CATALOG[boxId];
  if (!box) throw new Error(`Unknown box: ${boxId}`);
  const removedSet = new Set(removed);
  let keptWas = 0;
  box.items.forEach((it, i) => {
    // core items can never be removed — ignore an attempt to drop them.
    if (removedSet.has(i) && !it.core) return;
    keptWas += it.v;
  });
  const ratio = box.price / box.was;
  const itemsNow = Math.round(keptWas * ratio);
  let addTotal = 0;
  new Set(addons).forEach((i) => {
    const p = box.addons[i];
    if (typeof p === 'number') addTotal += p;
  });
  return itemsNow + addTotal;
}

function bundleDollars(): number {
  const was = Object.values(CATALOG).reduce((s, b) => s + b.price, 0);
  return Math.round(was * BUNDLE_DISCOUNT);
}

interface ReqLine { box_id: string; removed?: number[]; addons?: number[] }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // User-scoped client for auth; service client for the privileged writes.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json();
    const lines: ReqLine[] = Array.isArray(body?.lines) ? body.lines : [];
    const bundle: boolean = body?.bundle === true;
    const shipping = body?.shipping ?? {};

    if (lines.length === 0 && !bundle) {
      return json({ error: 'Cart is empty' }, 400);
    }

    // ── Recompute the authoritative amount ──────────────────────────────
    let subtotal = 0;
    const itemRows: { box_id: string; removed: number[]; addons: number[]; cents: number }[] = [];

    if (bundle) {
      const cents = bundleDollars() * 100;
      subtotal += cents;
      // Expand the bundle into its three boxes (full, no customization) so the
      // order record is fulfillable. Price is attributed to the bundle line as
      // a whole; we store each box as a $0-attributed item under is_bundle.
      for (const boxId of Object.keys(CATALOG)) {
        itemRows.push({ box_id: boxId, removed: [], addons: [], cents: 0 });
      }
    }

    for (const l of lines) {
      const removed = Array.isArray(l.removed) ? l.removed : [];
      const addons = Array.isArray(l.addons) ? l.addons : [];
      const cents = lineDollars(l.box_id, removed, addons) * 100;
      subtotal += cents;
      itemRows.push({ box_id: l.box_id, removed, addons, cents });
    }

    // Shipping/tax are $0 at launch (free shipping is baked into box pricing);
    // amount == subtotal. Kept as separate columns so we can add them later
    // without a client change.
    const amount = subtotal;

    if (amount < 50) {
      return json({ error: 'Invalid amount' }, 400);
    }

    // ── Create the Stripe PaymentIntent ─────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        kind: 'villie_box',
        user_id: user.id,
        is_bundle: String(bundle),
        line_count: String(itemRows.length),
      },
      automatic_payment_methods: { enabled: true },
    });

    // ── Persist the draft order (service role) ──────────────────────────
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: order, error: orderErr } = await service
      .from('villie_box_orders')
      .insert({
        user_id: user.id,
        status: 'pending_payment',
        is_bundle: bundle,
        subtotal_cents: subtotal,
        amount_cents: amount,
        currency: 'usd',
        stripe_payment_intent_id: paymentIntent.id,
        ship_name: str(shipping.name),
        ship_line1: str(shipping.line1),
        ship_line2: str(shipping.line2),
        ship_city: str(shipping.city),
        ship_state: str(shipping.state),
        ship_zip: str(shipping.zip),
        ship_phone: str(shipping.phone),
      })
      .select('id')
      .single();

    if (orderErr || !order) {
      // The PI exists but we couldn't record the order — cancel the PI so we
      // never hold an unrecorded authorization, then surface the error.
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {});
      return json({ error: orderErr?.message ?? 'Could not create order' }, 500);
    }

    if (itemRows.length > 0) {
      await service.from('villie_box_order_items').insert(
        itemRows.map((r) => ({
          order_id: order.id,
          box_id: r.box_id,
          removed_indices: r.removed,
          addon_indices: r.addons,
          line_amount_cents: r.cents,
        })),
      );
    }

    return json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      order_id: order.id,
      amount_cents: amount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create payment intent';
    return json({ error: message }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}
