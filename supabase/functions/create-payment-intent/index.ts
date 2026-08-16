// Edge Function: create-payment-intent
// Creates a Stripe PaymentIntent for in-app specialist bookings.
// Called from PaymentScreen before presenting Stripe PaymentSheet.
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { amount_cents, specialist_id, service_name, currency = 'usd' } = await req.json();

    if (!specialist_id || !service_name) {
      return new Response(JSON.stringify({ error: 'specialist_id and service_name are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Price the charge SERVER-SIDE ──────────────────────────────────
    // SECURITY (appsec F-M1 / M-2): the charge used to be `amount_cents`
    // straight off the request body, validated only as `>= 50`. A tampered
    // client could name its own price — including the base the 15% platform
    // fee and the Connect payout are computed from. The client's number is now
    // advisory only; the specialist's own catalogue row is the source of truth.
    // This mirrors what boxes-create-payment-intent already does.
    const { data: service, error: serviceErr } = await supabase
      .from('specialist_services')
      .select('price_cents, service_name')
      .eq('specialist_id', specialist_id)
      .eq('service_name', service_name)
      .maybeSingle();

    if (serviceErr) {
      console.error('create-payment-intent service lookup error', serviceErr);
      return new Response(JSON.stringify({ error: 'Could not price this service' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!service) {
      // No catalogue row ⇒ nothing authoritative to charge. Fail closed rather
      // than falling back to the client's figure.
      return new Response(JSON.stringify({ error: 'Unknown service for this specialist' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chargeCents = service.price_cents ?? 0;

    if (chargeCents < 50) {
      // Free/unpriced services must not reach Stripe — BookingScreen already
      // routes those straight to confirmation without a payment step.
      return new Response(JSON.stringify({ error: 'This service is not payable' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof amount_cents === 'number' && amount_cents !== chargeCents) {
      // Not fatal — a stale client can legitimately hold an old price. We charge
      // the catalogue price regardless, but this is worth seeing.
      console.warn(
        `create-payment-intent price mismatch: client=${amount_cents} server=${chargeCents} ` +
        `specialist=${specialist_id} service=${service_name}`,
      );
    }

    // Fetch specialist to get their stripe_account_id (for Connect)
    const { data: specialist } = await supabase
      .from('specialists')
      .select('stripe_account_id, full_name')
      .eq('id', specialist_id)
      .single();

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: chargeCents,
      currency,
      metadata: {
        specialist_id,
        service_name,
        user_id: user.id,
      },
      automatic_payment_methods: { enabled: true },
    };

    // If specialist has Stripe Connect account, route payment to them (15% platform fee)
    if (specialist?.stripe_account_id) {
      intentParams.application_fee_amount = Math.round(chargeCents * 0.15);
      intentParams.transfer_data = { destination: specialist.stripe_account_id };
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    // Return both client_secret (for Stripe SDK) and payment_intent_id. The
    // client uses the PI id as a support reference if the post-charge
    // appointment-create step fails — gives ops a stable handle to reconcile
    // the captured payment with a missing DB row.
    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        // The amount actually charged, recomputed server-side. Clients should
        // display THIS, not the figure they sent — same contract as
        // boxes-create-payment-intent.
        amount_cents: chargeCents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message ?? 'Failed to create payment intent' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
