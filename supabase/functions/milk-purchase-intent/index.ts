// milk-purchase-intent — creates Stripe PaymentIntent for a milk purchase
// Routes funds to the donor's connected Stripe account, takes 15% platform fee.
// Inserts a PENDING milk_transactions row that gets updated by milk-purchase-confirmed.
// POST /functions/v1/milk-purchase-intent
// Body: { donor_profile_id, listing_id, oz, fulfillment_method, recipient_address?, recipient_notes? }

import Stripe from 'npm:stripe';
import { createClient } from 'npm:@supabase/supabase-js';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const PLATFORM_FEE_PCT = 0.15;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

    // User-scoped client for auth
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401, headers: CORS });

    // Service-role client for transaction insert (bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const {
      donor_profile_id,
      listing_id,
      oz,
      fulfillment_method = 'pickup',
      recipient_address,
      recipient_notes,
    } = await req.json();

    if (!donor_profile_id || !listing_id || !oz || oz < 1) {
      return new Response(JSON.stringify({ error: 'donor_profile_id, listing_id, oz required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Fetch listing & donor in parallel — verify availability
    const [{ data: listing }, { data: donor }] = await Promise.all([
      supabase.from('milk_listings')
        .select('id, oz_available, price_per_oz, min_order_oz, shipping_price, pickup_available, shipping_available, status')
        .eq('id', listing_id).single(),
      supabase.from('milk_donor_profiles')
        .select('id, display_name, stripe_account_id, stripe_onboarding_complete, is_active')
        .eq('id', donor_profile_id).single(),
    ]);

    if (!listing || listing.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Listing unavailable' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (oz < listing.min_order_oz) {
      return new Response(JSON.stringify({ error: `Minimum order ${listing.min_order_oz} oz` }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (oz > listing.oz_available) {
      return new Response(JSON.stringify({ error: `Only ${listing.oz_available} oz available` }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (!donor || !donor.is_active || !donor.stripe_account_id || !donor.stripe_onboarding_complete) {
      return new Response(JSON.stringify({ error: 'Donor cannot accept payments' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (fulfillment_method === 'shipping' && !listing.shipping_available) {
      return new Response(JSON.stringify({ error: 'Donor does not ship' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (fulfillment_method === 'pickup' && !listing.pickup_available) {
      return new Response(JSON.stringify({ error: 'Donor does not offer pickup' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Compute pricing in cents
    const subtotalCents = Math.round(Number(listing.price_per_oz) * oz * 100);
    const shippingCents = fulfillment_method === 'shipping' && listing.shipping_price
      ? Math.round(Number(listing.shipping_price) * 100)
      : 0;
    const totalCents = subtotalCents + shippingCents;
    const platformFeeCents = Math.round(subtotalCents * PLATFORM_FEE_PCT);
    const donorPayoutCents = totalCents - platformFeeCents;

    // Create PaymentIntent with Connect destination charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: donor.stripe_account_id },
      automatic_payment_methods: { enabled: true },
      metadata: {
        kind: 'milk_purchase',
        donor_profile_id,
        listing_id,
        recipient_user_id: user.id,
        oz: String(oz),
      },
    });

    // Insert PENDING transaction row
    const addr = recipient_address ?? {};
    const { data: tx, error: txErr } = await supabase
      .from('milk_transactions')
      .insert({
        listing_id,
        donor_profile_id,
        recipient_user_id: user.id,
        oz_purchased: oz,
        price_per_oz: listing.price_per_oz,
        subtotal_cents: subtotalCents,
        platform_fee_cents: platformFeeCents,
        total_charged_cents: totalCents,
        donor_payout_cents: donorPayoutCents,
        stripe_payment_intent: paymentIntent.id,
        fulfillment_method,
        status: 'pending',
        recipient_address_line: addr.line ?? null,
        recipient_city: addr.city ?? null,
        recipient_state: addr.state ?? null,
        recipient_zip: addr.zip ?? null,
        recipient_notes: recipient_notes ?? null,
      })
      .select('id')
      .single();

    if (txErr) throw txErr;

    return new Response(JSON.stringify({
      transaction_id: tx.id,
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      donor_stripe_account_id: donor.stripe_account_id,
      total_cents: totalCents,
      subtotal_cents: subtotalCents,
      shipping_cents: shippingCents,
      platform_fee_cents: platformFeeCents,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('milk-purchase-intent error:', err);
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
