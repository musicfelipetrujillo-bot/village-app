// villie pro — nightly entitlement reconcile.
// POST /functions/v1/pro-entitlement-reconcile   { "limit": 200 }
//
// Why this exists: `revenuecat-webhook` is the only writer of users.is_pro,
// and a webhook is a delivery, not a state. If one is dropped, mis-signed,
// or lands while the DB is unreachable, the column drifts and NOTHING
// notices — a paying mother stays locked out, or a churned one keeps access.
// This job asks RevenueCat directly and repairs both directions.
//
// Scope: every user we have any reason to believe touches Pro —
//   · users.is_pro = TRUE                    (catches missed revocations)
//   · anyone with a pro_subscription_events row (catches missed grants)
// Users who never interacted with a subscription are never queried.
//
// Requires `REVENUECAT_SECRET_KEY`. Without it every lookup returns null and
// the job is a no-op by design: unknown must never be read as "not entitled".
//
// Scheduled from .github/workflows/supabase-crons.yml (40 6 * * * — 02:40 ET).

import { createClient } from 'jsr:@supabase/supabase-js@2.115.0';
import { fetchProEntitlement } from '../_shared/revenuecat.ts';
import { isServiceRoleRequest } from '../_shared/service-role.ts';

import { secretKey } from '../_shared/keys.ts';
const RC_SECRET_KEY = Deno.env.get('REVENUECAT_SECRET_KEY');
const DEFAULT_LIMIT = 200;
// RevenueCat lookups are ~200-400ms each; 5-wide keeps a 200-user sweep near
// 15s, comfortably inside the 60s edge-function wall.
const CONCURRENCY = 5;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// AUTH (2026-09-06) — the last unverified-JWT gate in the codebase.
//
// What stood here decoded the bearer's payload and returned `role === 'service_role'`
// WITHOUT VERIFYING THE SIGNATURE, justified by: "The gateway verifies the JWT
// signature; we only need to know WHICH role signed in." That premise was false
// for this function specifically — it was the ONLY function absent from the
// `verify_jwt` registry in supabase/config.toml (75 pinned, this one missing), so
// nothing established that the gateway was checking signatures at all. A JWT is
// three base64 segments joined by dots and the signature segment was never read,
// so anyone could send
//
//     Authorization: Bearer x.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.x
//
// and drive a fleet-wide entitlement sweep against the RevenueCat API. This is the
// identical defect that _shared/service-role.ts was written to kill after the
// 2026-08-14 incident; five of the six affected functions were migrated then, and
// this one was missed.
//
// The stated reason for reading the claim rather than comparing keys was real:
// this project has more than one valid service-role key in circulation (the GH
// Actions secret and the runtime-injected key are both correctly signed but not
// byte-identical), so a strict equality check 401s this nightly cron. That is
// exactly why the shared helper is TWO-MODE — it accepts the injected key OR an
// authentic `service_role` claim — so rotation tolerance is kept without trusting
// an unverified token.
//
// gatewayVerifiesJwt: true is sound ONLY because this commit also adds the
// [functions.pro-entitlement-reconcile] verify_jwt pin to supabase/config.toml.
// The two must ship together, and this function must never be deployed with
// --no-verify-jwt.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!isServiceRoleRequest(req, { gatewayVerifiesJwt: true })) {
    return json(403, { error: 'service_role_required' });
  }

  if (!RC_SECRET_KEY) {
    // Expected before the Build 14 secrets land — surface it as a healthy
    // no-op so the cron doesn't go red every night until then.
    return json(200, { ok: true, skipped: 'no_revenuecat_secret_key' });
  }

  let limit = DEFAULT_LIMIT;
  try {
    const body = await req.json() as { limit?: number };
    if (typeof body?.limit === 'number' && body.limit > 0) {
      limit = Math.min(body.limit, 1000);
    }
  } catch { /* empty body — use the default */ }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    secretKey(),
  );

  // Candidate set: currently-flagged users + anyone who has ever produced a
  // subscription event. Deduped in memory — both sides are small.
  const [flagged, ledger] = await Promise.all([
    supabase.from('users').select('id, is_pro').eq('is_pro', true).limit(limit),
    supabase
      .from('pro_subscription_events')
      .select('user_id')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit * 5),
  ]);

  if (flagged.error || ledger.error) {
    console.error('[pro-reconcile] candidate query failed',
      flagged.error?.message ?? ledger.error?.message);
    return json(500, { error: 'candidate_query_failed' });
  }

  const ids = new Set<string>();
  for (const row of flagged.data ?? []) ids.add(row.id as string);
  for (const row of ledger.data ?? []) ids.add(row.user_id as string);

  // Re-read the column for the whole set rather than inferring it from which
  // query produced the id — `flagged` is capped by `limit`, so an id that
  // arrived via the ledger may well already be is_pro = TRUE. This also drops
  // ids whose user row is gone (hard-deleted / never existed).
  const { data: rows, error: stateErr } = await supabase
    .from('users')
    .select('id, is_pro')
    .in('id', [...ids].slice(0, limit));
  if (stateErr) {
    console.error('[pro-reconcile] state query failed', stateErr.message);
    return json(500, { error: 'state_query_failed' });
  }
  const candidates: Array<[string, boolean]> =
    (rows ?? []).map((r) => [r.id as string, r.is_pro === true]);

  let checked = 0, granted = 0, revoked = 0, unresolved = 0;

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const slice = candidates.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map(async ([userId, currentlyPro]) => {
      checked++;
      const entitled = await fetchProEntitlement(userId, RC_SECRET_KEY);
      if (entitled === null) { unresolved++; return; }
      if (entitled === currentlyPro) return;

      const { error } = await supabase
        .from('users').update({ is_pro: entitled }).eq('id', userId);
      if (error) {
        console.error(`[pro-reconcile] update failed for ${userId}:`, error.message);
        unresolved++;
        return;
      }
      if (entitled) granted++; else revoked++;
      // Drift is never routine — every correction means a webhook didn't
      // land, so log one line per repair for the ops trail.
      console.warn(`[pro-reconcile] repaired ${userId}: is_pro ${currentlyPro} → ${entitled}`);
    }));
  }

  return json(200, { ok: true, checked, granted, revoked, unresolved });
});
