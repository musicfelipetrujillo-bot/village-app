// milk-purchase-confirmed — called from mobile after Stripe PaymentSheet succeeds
// 1. Verifies the PaymentIntent succeeded server-side
// 2. Marks transaction as 'paid' (DB trigger decrements supply atomically)
// 3. Sends Twilio SMS to donor (order details + recipient phone)
// 4. Sends Twilio SMS to recipient (donor address + phone)
// POST /functions/v1/milk-purchase-confirmed
// Body: { transaction_id }
//
// ──────────────────────────────────────────────────────────────────────
// ⚠️  DEPRECATED — 2026-05-21
// ──────────────────────────────────────────────────────────────────────
// Companion to milk-purchase-intent. V2 Milk Hub is now CASH-ONLY
// (see memory/project_milk_cash_only.md). The mobile Stripe purchase
// flow is gated OFF behind EXPO_PUBLIC_MILK_STRIPE_ENABLED — no
// production code path reaches this function. Don't edit without
// reversing the cash-only decision first.
// ──────────────────────────────────────────────────────────────────────

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

async function sendSms(to: string, body: string): Promise<void> {
  if (!to) return;
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!sid || !token || !from) {
    console.warn('Twilio creds missing — skipping SMS');
    return;
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    console.error('Twilio SMS failed:', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401, headers: CORS });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { transaction_id } = await req.json();
    if (!transaction_id) {
      return new Response(JSON.stringify({ error: 'transaction_id required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Load transaction
    const { data: tx, error: txErr } = await supabase
      .from('milk_transactions')
      .select('id, recipient_user_id, donor_profile_id, oz_purchased, total_charged_cents, fulfillment_method, status, stripe_payment_intent')
      .eq('id', transaction_id)
      .single();
    if (txErr || !tx) throw txErr ?? new Error('Transaction not found');
    if (tx.recipient_user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Idempotent — if already paid, return current state
    if (tx.status === 'paid' || tx.status === 'fulfilled') {
      return new Response(JSON.stringify({ status: tx.status, already: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Verify with Stripe
    const pi = await stripe.paymentIntents.retrieve(tx.stripe_payment_intent);
    if (pi.status !== 'succeeded') {
      return new Response(JSON.stringify({ error: `PaymentIntent status: ${pi.status}` }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();

    // Mark paid (trigger decrements supply)
    const { error: updErr } = await supabase
      .from('milk_transactions')
      .update({ status: 'paid', address_revealed_at: now })
      .eq('id', transaction_id);
    if (updErr) throw updErr;

    // Hydrate donor + recipient contact info
    const [{ data: donor }, { data: recipient }] = await Promise.all([
      supabase.from('milk_donor_profiles')
        .select('display_name, address_line, city, state, zip_code, phone, user_id')
        .eq('id', tx.donor_profile_id).single(),
      supabase.from('users') // assume profile table; fallback to auth.users.raw_user_meta_data
        .select('phone, full_name')
        .eq('id', tx.recipient_user_id).maybeSingle(),
    ]);

    // Recipient phone fallback from auth metadata
    let recipientPhone = recipient?.phone ?? null;
    let recipientName = recipient?.full_name ?? 'A recipient';
    if (!recipientPhone) {
      const { data: authRec } = await supabase.auth.admin.getUserById(tx.recipient_user_id);
      recipientPhone = authRec?.user?.phone ?? authRec?.user?.user_metadata?.phone ?? null;
      recipientName = authRec?.user?.user_metadata?.full_name ?? recipientName;
    }

    // Donor phone fallback
    let donorPhone = donor?.phone ?? null;
    if (!donorPhone && donor?.user_id) {
      const { data: authDon } = await supabase.auth.admin.getUserById(donor.user_id);
      donorPhone = authDon?.user?.phone ?? authDon?.user?.user_metadata?.phone ?? null;
    }

    const totalDollars = (tx.total_charged_cents / 100).toFixed(2);
    const fulfillmentLabel = tx.fulfillment_method === 'pickup' ? 'pickup' : 'shipping';

    // SMS to donor
    const donorMsg =
      `🤱 The Village — New order!\n` +
      `${recipientName} purchased ${tx.oz_purchased} oz ($${totalDollars}, ${fulfillmentLabel}).\n` +
      (recipientPhone ? `Recipient: ${recipientPhone}\n` : '') +
      `Open the app to coordinate.`;

    // SMS to recipient
    const addressLine = donor?.address_line
      ? `${donor.address_line}, ${donor.city ?? ''} ${donor.state ?? ''} ${donor.zip_code ?? ''}`.trim()
      : `${donor?.city ?? ''} ${donor?.state ?? ''}`.trim();
    const recipientMsg =
      `🤱 Order confirmed!\n` +
      `${donor?.display_name ?? 'Your donor'} will reach out to coordinate ${fulfillmentLabel}.\n` +
      (tx.fulfillment_method === 'pickup' && addressLine ? `Pickup: ${addressLine}\n` : '') +
      (donorPhone ? `Donor: ${donorPhone}` : '');

    const smsResults = await Promise.allSettled([
      donorPhone ? sendSms(donorPhone, donorMsg) : Promise.resolve(),
      recipientPhone ? sendSms(recipientPhone, recipientMsg) : Promise.resolve(),
    ]);

    // Best-effort timestamp updates (don't fail the request if SMS failed)
    const smsUpdate: Record<string, string> = {};
    if (smsResults[0].status === 'fulfilled' && donorPhone) smsUpdate.donor_notified_at = now;
    if (smsResults[1].status === 'fulfilled' && recipientPhone) smsUpdate.recipient_notified_at = now;
    if (Object.keys(smsUpdate).length > 0) {
      await supabase.from('milk_transactions').update(smsUpdate).eq('id', transaction_id);
    }

    return new Response(JSON.stringify({
      status: 'paid',
      transaction_id,
      donor_notified: smsResults[0].status === 'fulfilled' && !!donorPhone,
      recipient_notified: smsResults[1].status === 'fulfilled' && !!recipientPhone,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('milk-purchase-confirmed error:', err);
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
