// milk-dispute-open — opens a dispute on a milk transaction.
// Caller must be either the recipient or the donor on the transaction.
// The AFTER-INSERT trigger (mark_transaction_disputed) flips
// milk_transactions.status -> 'disputed'.
//
// POST /functions/v1/milk-dispute-open
// Body: {
//   transaction_id: string,
//   reason_code: 'never_received' | 'quality_concern' | 'wrong_quantity' |
//                'spoiled' | 'no_show_pickup' | 'other',
//   description: string,                // required — at least 20 chars
//   evidence_urls?: string[]            // Supabase Storage URLs
// }
import { createClient } from 'npm:@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const VALID_REASONS = new Set([
  'never_received', 'quality_concern', 'wrong_quantity',
  'spoiled', 'no_show_pickup', 'other',
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function sendSms(to: string | null | undefined, body: string): Promise<void> {
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
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { transaction_id, reason_code, description, evidence_urls } = await req.json();

    if (!transaction_id || !reason_code || !description) {
      return json({ error: 'transaction_id, reason_code, description required' }, 400);
    }
    if (!VALID_REASONS.has(reason_code)) {
      return json({ error: `Invalid reason_code: ${reason_code}` }, 400);
    }
    if (typeof description !== 'string' || description.trim().length < 20) {
      return json({ error: 'description must be at least 20 characters' }, 400);
    }

    // Load transaction + resolve caller role
    const { data: tx, error: txErr } = await supabase
      .from('milk_transactions')
      .select('id, recipient_user_id, donor_profile_id, status, total_charged_cents')
      .eq('id', transaction_id)
      .single();
    if (txErr || !tx) return json({ error: 'Transaction not found' }, 404);

    const { data: donor } = await supabase
      .from('milk_donor_profiles')
      .select('user_id, display_name')
      .eq('id', tx.donor_profile_id)
      .single();

    let opened_by_role: 'recipient' | 'donor' | null = null;
    if (tx.recipient_user_id === user.id) opened_by_role = 'recipient';
    else if (donor?.user_id === user.id) opened_by_role = 'donor';
    if (!opened_by_role) return json({ error: 'Not a party to this transaction' }, 403);

    // Business rule: can only dispute paid/fulfilled orders, not pending/refunded/cancelled
    if (!['paid', 'fulfilled', 'disputed'].includes(tx.status)) {
      return json({ error: `Cannot dispute a ${tx.status} order` }, 400);
    }

    // Idempotency — UNIQUE (transaction_id) on the table, but give a clean error
    const { data: existing } = await supabase
      .from('milk_disputes')
      .select('*')
      .eq('transaction_id', transaction_id)
      .maybeSingle();
    if (existing) {
      return json({ dispute: existing, already: true });
    }

    const { data: inserted, error: insErr } = await supabase
      .from('milk_disputes')
      .insert({
        transaction_id,
        opened_by_user_id: user.id,
        opened_by_role,
        reason_code,
        description: description.trim(),
        evidence_urls: evidence_urls ?? null,
        status: 'open',
      })
      .select()
      .single();
    if (insErr) throw insErr;

    // Audit-log the legal-relevant event server-side (survives client outage)
    await supabase.from('milk_analytics_events').insert({
      user_id: user.id,
      event_name: 'milk_dispute_opened',
      properties: {
        transaction_id,
        reason_code,
        opened_by_role,
        amount_cents: tx.total_charged_cents,
      },
    });

    // Notify the other party (best-effort SMS)
    const otherUserId = opened_by_role === 'recipient' ? donor?.user_id : tx.recipient_user_id;
    if (otherUserId) {
      const { data: other } = await supabase.auth.admin.getUserById(otherUserId);
      const phone = other?.user?.phone ?? other?.user?.user_metadata?.phone;
      await sendSms(
        phone,
        '🤱 The Village — a concern was raised on one of your milk orders. ' +
        'Open the app to review and respond.',
      );
    }

    return json({ dispute: inserted, already: false });
  } catch (err) {
    console.error('milk-dispute-open error:', err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
