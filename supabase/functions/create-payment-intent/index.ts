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

    if (!amount_cents || amount_cents < 50) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch specialist to get their stripe_account_id (for Connect)
    const { data: specialist } = await supabase
      .from('specialists')
      .select('stripe_account_id, full_name')
      .eq('id', specialist_id)
      .single();

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: amount_cents,
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
      intentParams.application_fee_amount = Math.round(amount_cents * 0.15);
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
