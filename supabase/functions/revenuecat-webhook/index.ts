// villie pro — RevenueCat subscription webhook → users.is_pro sync.
// POST /functions/v1/revenuecat-webhook   (verify_jwt OFF — RevenueCat can't
// send a Supabase JWT; auth is a shared bearer token instead.)
//
// RevenueCat → Project → Integrations → Webhooks:
//   URL:            https://<ref>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization:  Bearer <REVENUECAT_WEBHOOK_AUTH>   (paste the same value
//                   into Supabase Edge Function secrets)
//
// Contract (docs/superpowers/specs/2026-07-29-villie-pro-video-paywall-design.md):
//   · app_user_id == our Supabase user id (client calls Purchases.logIn(uid);
//     $RCAnonymousID:* events are logged + skipped).
//   · Entitlement id 'pro' (villie_pro_monthly / villie_pro_annual).
//   · is_pro := TRUE  on INITIAL_PURCHASE / RENEWAL / UNCANCELLATION /
//               PRODUCT_CHANGE / NON_RENEWING_PURCHASE carrying 'pro'.
//   · is_pro := FALSE on EXPIRATION.
//   · CANCELLATION (auto-renew off, still entitled until period end) and
//     BILLING_ISSUE (grace window) change nothing — EXPIRATION is the single
//     source of truth for access loss, mirroring RevenueCat's own guidance.
//   · Gear Boost purchases (gear_boost_7d) also arrive here as
//     NON_RENEWING_PURCHASE without the 'pro' entitlement — ledgered, no flag
//     change (activation is handled by gear-boost-activate, client-initiated).
//
// Idempotency: pro_subscription_events.event_id is UNIQUE; a replayed event
// inserts nothing and returns 200 so RevenueCat stops retrying.
// Unknown/malformed users return 200 (logged) for the same reason — a 4xx/5xx
// would put RevenueCat into a retry loop it can never win.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';

const PRO_ENTITLEMENT = 'pro';
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
]);
const REVOKE_EVENTS = new Set(['EXPIRATION']);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  // Shared-token auth. Constant-time-ish comparison is overkill for a random
  // 32+ char token, but never proceed on an empty secret (fail-closed).
  const auth = req.headers.get('authorization') ?? '';
  if (!WEBHOOK_AUTH || auth !== `Bearer ${WEBHOOK_AUTH}`) {
    return json(401, { error: 'unauthorized' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const event = (payload?.event ?? {}) as Record<string, unknown>;
  const eventId = typeof event.id === 'string' ? event.id : null;
  const eventType = typeof event.type === 'string' ? event.type : null;
  if (!eventId || !eventType) {
    console.warn('[revenuecat-webhook] malformed event', JSON.stringify(payload).slice(0, 400));
    return json(400, { error: 'malformed_event' });
  }

  const appUserId = typeof event.app_user_id === 'string' ? event.app_user_id : '';
  const entitlements = Array.isArray(event.entitlement_ids)
    ? (event.entitlement_ids as string[]).filter((e) => typeof e === 'string')
    : [];
  const userId = UUID_RE.test(appUserId) ? appUserId.toLowerCase() : null;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Ledger first (audit trail even for events we don't act on). A
  //    duplicate event_id means we already processed this delivery — 200 out.
  const { error: insertErr } = await supabase.from('pro_subscription_events').insert({
    event_id: eventId,
    user_id: userId,
    event_type: eventType,
    product_id: typeof event.product_id === 'string' ? event.product_id : null,
    entitlement_ids: entitlements,
    environment: typeof event.environment === 'string' ? event.environment : null,
    event_timestamp: typeof event.event_timestamp_ms === 'number'
      ? new Date(event.event_timestamp_ms).toISOString()
      : null,
    raw: payload,
  });
  if (insertErr) {
    if (insertErr.code === '23505') {
      return json(200, { ok: true, duplicate: true });
    }
    console.error('[revenuecat-webhook] ledger insert failed', insertErr.message);
    return json(500, { error: 'ledger_insert_failed' });
  }

  // 2. Entitlement flip. Only 'pro' events touch users.is_pro.
  const touchesPro = entitlements.includes(PRO_ENTITLEMENT);
  let action = 'none';
  if (userId && touchesPro) {
    if (GRANT_EVENTS.has(eventType)) action = 'grant';
    else if (REVOKE_EVENTS.has(eventType)) action = 'revoke';
  }

  if (action !== 'none') {
    const { error: updateErr } = await supabase
      .from('users')
      .update({ is_pro: action === 'grant' })
      .eq('id', userId);
    if (updateErr) {
      // Ledger row exists; RevenueCat will NOT retry (200). Surface loudly so
      // the drift is visible in function logs + can be replayed from the ledger.
      console.error(`[revenuecat-webhook] is_pro ${action} failed for ${userId}:`, updateErr.message);
      return json(200, { ok: false, action, error: 'user_update_failed' });
    }
  } else if (!userId && touchesPro) {
    console.warn(`[revenuecat-webhook] pro event ${eventType} for non-uuid app_user_id "${appUserId.slice(0, 40)}" — skipped`);
  }

  return json(200, { ok: true, action });
});
