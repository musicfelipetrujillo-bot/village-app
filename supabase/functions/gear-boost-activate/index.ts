// V4 Gear — activate a paid listing boost after a validated store purchase.
// POST /functions/v1/gear-boost-activate
//
// Body: { listing_id, platform_transaction_id, product_id, platform?, source? }
// Caller is identified via the JWT in the Authorization header (we never trust
// a user_id from the body). The listing must belong to the caller — enforced
// again in the activate_gear_boost RPC.
//
// SECURITY — why the client can't fake a boost:
//   1. We resolve the user from their JWT (not the body).
//   2. We VERIFY the purchase with the store before activating. For IAP we
//      check RevenueCat for a non-subscription purchase of the boost product
//      whose store_transaction_id matches the one passed in. Without a
//      verified receipt we REJECT (fail-closed) — except when
//      BOOST_ALLOW_UNVERIFIED='1' is set for sandbox/dev.
//   3. Activation runs through the service-role-only activate_gear_boost RPC,
//      and the gear_boosts ledger has a UNIQUE(platform_transaction_id) index,
//      so a replayed transaction is a no-op (idempotent success).
//
// Build 14 / RevenueCat setup: docs/V4_GEAR_BOOST_RUNBOOK.md
// Required Edge Function secrets (prod): REVENUECAT_SECRET_KEY
// Dev/sandbox escape hatch: BOOST_ALLOW_UNVERIFIED='1'

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const REVENUECAT_SECRET_KEY = Deno.env.get('REVENUECAT_SECRET_KEY') ?? '';
const ALLOW_UNVERIFIED = Deno.env.get('BOOST_ALLOW_UNVERIFIED') === '1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowlisted boost products → boost duration in days. Reject anything else so
// a transaction for some other product can't be used to activate a boost.
const BOOST_PRODUCTS: Record<string, number> = {
  gear_boost_7d: 7,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: 'missing_auth' }, 401);

    // Anon-key client + the caller's JWT — identity resolution only, no
    // elevated privilege. (Mutations run through the service-role client below.)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ ok: false, error: 'invalid_auth' }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const listingId = String(body.listing_id ?? '').trim();
    const txnId = String(body.platform_transaction_id ?? '').trim();
    const productId = String(body.product_id ?? '').trim();
    const platform = body.platform === 'android' ? 'android' : 'ios';
    const source = body.source === 'pro_perk' ? 'pro_perk' : 'iap';

    if (!listingId) return json({ ok: false, error: 'missing_listing_id' }, 400);
    const durationDays = BOOST_PRODUCTS[productId];
    if (!durationDays) return json({ ok: false, error: 'unknown_product' }, 400);

    // Pro-perk free boosts depend on the V5 Pro tier + entitlement check, which
    // isn't live yet. Reject explicitly rather than silently granting.
    if (source === 'pro_perk') return json({ ok: false, error: 'pro_perk_not_available' }, 400);

    if (!txnId) return json({ ok: false, error: 'missing_transaction_id' }, 400);

    // ── Verify the purchase ──────────────────────────────────────────────────
    if (!ALLOW_UNVERIFIED) {
      if (!REVENUECAT_SECRET_KEY) {
        // Fail-closed: never activate a paid feature without verification in prod.
        return json({ ok: false, error: 'verification_unavailable' }, 503);
      }
      const verified = await verifyRevenueCatPurchase(userId, productId, txnId);
      if (!verified) return json({ ok: false, error: 'receipt_not_verified' }, 402);
    } else {
      console.warn('[gear-boost-activate] BOOST_ALLOW_UNVERIFIED=1 — skipping receipt verification (dev/sandbox only)');
    }

    // ── Activate via service-role RPC ────────────────────────────────────────
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: boostedUntil, error: rpcErr } = await admin.rpc('activate_gear_boost', {
      p_listing_id: listingId,
      p_user_id: userId,
      p_source: source,
      p_platform: platform,
      p_product_id: productId,
      p_transaction_id: txnId,
      p_duration_days: durationDays,
    });

    if (rpcErr) {
      // Replays are handled idempotently inside activate_gear_boost (it swallows
      // the UNIQUE(platform_transaction_id) violation and returns the existing
      // window), so the only errors that surface here are owner/not-found/other.
      if (/not listing owner/i.test(rpcErr.message)) return json({ ok: false, error: 'not_owner' }, 403);
      if (/listing not found/i.test(rpcErr.message)) return json({ ok: false, error: 'listing_not_found' }, 404);
      console.error('[gear-boost-activate] rpc failed:', rpcErr);
      return json({ ok: false, error: 'activation_failed', detail: rpcErr.message }, 500);
    }

    // Best-effort revenue/analytics row (non-fatal).
    try {
      await admin.from('gear_analytics_events').insert({
        user_id: userId,
        event_name: 'gear_boost_activated',
        properties: { listing_id: listingId, product_id: productId, source, platform, duration_days: durationDays },
      });
    } catch (e) {
      console.warn('[gear-boost-activate] analytics insert non-fatal:', e);
    }

    return json({ ok: true, boosted_until: boostedUntil ?? null });
  } catch (err) {
    console.error('[gear-boost-activate] fatal:', err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});

/**
 * Confirms RevenueCat recorded a non-subscription (consumable) purchase of
 * `productId` for `appUserId` with a matching store transaction id. The app
 * must call Purchases.logIn(supabaseUserId) so RC's app_user_id == our user id.
 * Fail-closed: any error / mismatch returns false (we won't activate).
 */
async function verifyRevenueCatPurchase(
  appUserId: string,
  productId: string,
  transactionId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${REVENUECAT_SECRET_KEY}` },
    });
    if (!res.ok) {
      console.warn('[gear-boost-activate] RevenueCat lookup failed:', res.status);
      return false;
    }
    const data = await res.json();
    const purchases = data?.subscriber?.non_subscriptions?.[productId];
    if (!Array.isArray(purchases)) return false;
    return purchases.some((p: { store_transaction_id?: string; id?: string }) =>
      p?.store_transaction_id === transactionId || p?.id === transactionId);
  } catch (e) {
    console.warn('[gear-boost-activate] RevenueCat verify exception:', e);
    return false;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
