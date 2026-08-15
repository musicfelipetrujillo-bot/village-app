// Shared RevenueCat REST helper — used by `revenuecat-webhook` (TRANSFER
// events, which carry no entitlement payload) and by
// `pro-entitlement-reconcile` (nightly drift repair).
//
// Webhooks are the fast path and the REST API is the source of truth: a
// dropped delivery is invisible until something asks RevenueCat directly.
//
// Requires `REVENUECAT_SECRET_KEY` (Project → API keys → secret). Without it
// every call returns null, which callers must treat as "unknown — change
// nothing", never as "not entitled".

const RC_BASE = 'https://api.revenuecat.com/v1';
const PRO_ENTITLEMENT = 'pro';

export type ProEntitlementState = boolean | null;

/**
 * Is `appUserId` currently entitled to `pro`?
 *
 *   true  — an active (or lifetime) 'pro' entitlement
 *   false — RevenueCat knows this subscriber and they are NOT entitled
 *   null  — unknown: no secret key, network/API failure, or unparseable body
 *
 * A 404 means RevenueCat has no such subscriber, which is a definitive "not
 * entitled" — that is the case that catches a stale is_pro=true row.
 */
export async function fetchProEntitlement(
  appUserId: string,
  secretKey: string | undefined,
): Promise<ProEntitlementState> {
  if (!secretKey) return null;
  try {
    const res = await fetch(
      `${RC_BASE}/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.status === 404) return false;
    if (!res.ok) {
      console.warn(`[revenuecat] subscriber lookup ${res.status} for ${appUserId}`);
      return null;
    }
    const body = await res.json() as {
      subscriber?: {
        entitlements?: Record<string, { expires_date?: string | null }>;
      };
    };
    const ent = body?.subscriber?.entitlements?.[PRO_ENTITLEMENT];
    if (!ent) return false;
    // A null expires_date is a lifetime grant. Otherwise compare to now —
    // RevenueCat keeps expired entitlements in the payload.
    if (ent.expires_date == null) return true;
    const expires = Date.parse(ent.expires_date);
    if (Number.isNaN(expires)) return null;
    return expires > Date.now();
  } catch (e) {
    console.warn(`[revenuecat] subscriber lookup failed for ${appUserId}:`, (e as Error).message);
    return null;
  }
}
