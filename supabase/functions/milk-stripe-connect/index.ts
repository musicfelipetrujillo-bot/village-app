// milk-stripe-connect — creates Stripe Connect Express onboarding link for donors
// POST { donor_profile_id, return_url, refresh_url }
// Returns { url } — open in WebView for onboarding

import Stripe from 'npm:stripe';
import { createClient } from 'npm:@supabase/supabase-js';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response('Unauthorized', { status: 401 });

    const { donor_profile_id, return_url, refresh_url } = await req.json();

    // Verify ownership
    const { data: profile } = await supabase
      .from('milk_donor_profiles')
      .select('id, stripe_account_id, display_name, user_id')
      .eq('id', donor_profile_id)
      .single();

    if (!profile || profile.user_id !== user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    // Get user email for Stripe pre-fill
    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single();

    let accountId = profile.stripe_account_id;

    // Create Stripe Express account if not yet created
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: userData?.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          donor_profile_id,
          user_id: user.id,
        },
      });
      accountId = account.id;

      await supabase
        .from('milk_donor_profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', donor_profile_id);
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refresh_url ?? 'thevillage://milk/stripe-refresh',
      return_url: return_url ?? 'thevillage://milk/stripe-return',
      type: 'account_onboarding',
    });

    return new Response(JSON.stringify({ url: accountLink.url, account_id: accountId }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('milk-stripe-connect error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
