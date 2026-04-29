// milk-shippo-label — buys a Shippo shipping label for a paid milk order
// Donor calls this from MilkShippingLabelScreen after the order is paid.
// 1. Verifies caller is the donor for this transaction
// 2. Calls Shippo API to create shipment + buy a rate
// 3. Inserts/updates milk_shipping_labels row
// 4. Optionally SMS the recipient with tracking link
// POST /functions/v1/milk-shippo-label
// Body: {
//   transaction_id: string,
//   from_address: { name, street1, city, state, zip, country, phone, email },
//   to_address:   { name, street1, city, state, zip, country, phone, email },
//   parcel:       { length, width, height, distance_unit: 'in', weight, mass_unit: 'oz' },
//   service_token?: string  // shippo servicelevel token (default usps_priority)
// }
import { createClient } from 'npm:@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const SHIPPO_BASE = 'https://api.goshippo.com';

async function shippo(path: string, body?: unknown) {
  const token = Deno.env.get('SHIPPO_API_TOKEN');
  if (!token) throw new Error('SHIPPO_API_TOKEN missing');
  const res = await fetch(`${SHIPPO_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Authorization': `ShippoToken ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Shippo ${path} failed: ${JSON.stringify(data)}`);
  return data;
}

async function sendSms(to: string, body: string): Promise<void> {
  if (!to) return;
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!sid || !token || !from) return;
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
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

    const {
      transaction_id, from_address, to_address, parcel,
      service_token = 'usps_priority',
    } = await req.json();
    if (!transaction_id || !from_address || !to_address || !parcel) {
      return new Response(JSON.stringify({ error: 'transaction_id, from_address, to_address, parcel required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is the donor for this tx
    const { data: tx } = await supabase
      .from('milk_transactions')
      .select('id, donor_profile_id, recipient_user_id, status, fulfillment_method')
      .eq('id', transaction_id).single();
    if (!tx) return new Response(JSON.stringify({ error: 'Transaction not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
    if (tx.fulfillment_method !== 'shipping') {
      return new Response(JSON.stringify({ error: 'Order is not shipping' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { data: donor } = await supabase
      .from('milk_donor_profiles')
      .select('user_id')
      .eq('id', tx.donor_profile_id).single();
    if (donor?.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only the donor can buy a label' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (tx.status !== 'paid' && tx.status !== 'fulfilled') {
      return new Response(JSON.stringify({ error: `Cannot ship in status: ${tx.status}` }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Idempotency — if a label already exists, return it
    const { data: existing } = await supabase
      .from('milk_shipping_labels')
      .select('*')
      .eq('transaction_id', transaction_id)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ label: existing, already: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 1. Create shipment to get rates
    const shipment = await shippo('/shipments/', {
      address_from: from_address,
      address_to: to_address,
      parcels: [parcel],
      async: false,
    });

    const rate = (shipment.rates ?? []).find((r: { servicelevel?: { token?: string } }) =>
      r.servicelevel?.token === service_token
    ) ?? shipment.rates?.[0];

    if (!rate) throw new Error('No rates returned by Shippo');

    // 2. Buy the rate (creates a transaction in Shippo terminology)
    const tx_buy = await shippo('/transactions/', {
      rate: rate.object_id,
      async: false,
      label_file_type: 'PDF',
    });

    if (tx_buy.status !== 'SUCCESS') {
      throw new Error(`Shippo buy failed: ${JSON.stringify(tx_buy.messages ?? tx_buy)}`);
    }

    // 3. Persist label
    const rateCents = Math.round(parseFloat(rate.amount) * 100);
    const { data: inserted, error: insErr } = await supabase
      .from('milk_shipping_labels')
      .insert({
        transaction_id,
        shippo_transaction_id: tx_buy.object_id,
        carrier: rate.provider?.toLowerCase() ?? 'usps',
        service_level: rate.servicelevel?.token,
        tracking_number: tx_buy.tracking_number,
        tracking_url: tx_buy.tracking_url_provider,
        label_url: tx_buy.label_url,
        rate_cents: rateCents,
        status: 'created',
      })
      .select()
      .single();
    if (insErr) throw insErr;

    // 4. SMS recipient with tracking link (best-effort)
    const { data: rec } = await supabase.auth.admin.getUserById(tx.recipient_user_id);
    const recPhone = rec?.user?.phone ?? rec?.user?.user_metadata?.phone;
    if (recPhone && tx_buy.tracking_url_provider) {
      await sendSms(recPhone,
        `🤱 The Village — your milk shipment is on the way! Track: ${tx_buy.tracking_url_provider}`,
      );
    }

    return new Response(JSON.stringify({ label: inserted, already: false }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('milk-shippo-label error:', err);
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
