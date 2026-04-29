// V4 Phase G3 — perks-redemption-webhook
// Receives conversion pings from affiliate networks and updates deal_claims.
//
// Per-network verification (replaces the original shared-secret stub):
//
//   • Impact        — HMAC-SHA256 of the raw request body using the partner
//                     "Auth Token" as the key. Network sends the signature in
//                     `x-impact-signature` as a hex digest. Secret:
//                     IMPACT_WEBHOOK_SECRET.
//
//   • ShareASale    — HMAC-SHA256 of the string
//                     `<api-secret-key>:<timestamp>:<method>:<path>` using the
//                     partner API Secret. Timestamp must be within ±300s of
//                     server clock. Headers: `x-shareasale-date`,
//                     `x-shareasale-authentication`. Secret:
//                     SHAREASALE_API_SECRET.
//
//   • CJ            — CJ does not sign webhooks; verification is via IP
//                     allowlist published by CJ. Env: `CJ_ALLOWED_IPS` —
//                     comma-separated v4 addresses. Compared against
//                     `x-forwarded-for` (Supabase edge runtime sets this).
//
//   • direct        — Shared-secret fallback for partner-direct (non-network)
//                     webhooks. Header `x-village-webhook-token`. Secret:
//                     PERKS_WEBHOOK_SECRET. Retained for MVP partners that
//                     don't run through an affiliate network.
//
// POST /functions/v1/perks-redemption-webhook
// Body (normalized): {
//   network: 'impact'|'shareasale'|'cj'|'direct',
//   subid: string,
//   network_order_id: string,
//   converted_amount_cents: number,
//   status?: 'confirmed'|'expired',
// }

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, ' +
    'x-village-webhook-token, x-impact-signature, x-shareasale-date, x-shareasale-authentication',
};

const TEXT_ENCODER = new TextEncoder();

// Timing-safe byte comparison. Do NOT short-circuit on length mismatch —
// early-out on length leaks length of the expected secret.
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = TEXT_ENCODER.encode(a);
  const bBytes = TEXT_ENCODER.encode(b);
  // Still OR in a 1 if lengths differ so we always return false, but the loop
  // still runs over the longer buffer to equalize timing.
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    const av = i < aBytes.length ? aBytes[i] : 0;
    const bv = i < bBytes.length ? bBytes[i] : 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, TEXT_ENCODER.encode(message));
  return toHex(sig);
}

// x-forwarded-for can be a comma-separated list (client, proxy1, proxy2).
// The left-most entry is the original client per Supabase's edge runtime.
function clientIpFrom(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || null;
  const xri = req.headers.get('x-real-ip');
  return xri?.trim() || null;
}

interface VerifyResult {
  ok: boolean;
  reason?: string;
}

async function verifyImpact(req: Request, rawBody: string): Promise<VerifyResult> {
  const secret = Deno.env.get('IMPACT_WEBHOOK_SECRET');
  if (!secret) return { ok: false, reason: 'impact_secret_not_configured' };
  const provided = req.headers.get('x-impact-signature');
  if (!provided) return { ok: false, reason: 'missing_signature' };
  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqual(expected, provided.toLowerCase())
    ? { ok: true }
    : { ok: false, reason: 'bad_signature' };
}

async function verifyShareASale(req: Request): Promise<VerifyResult> {
  const secret = Deno.env.get('SHAREASALE_API_SECRET');
  if (!secret) return { ok: false, reason: 'shareasale_secret_not_configured' };
  const timestamp = req.headers.get('x-shareasale-date');
  const provided = req.headers.get('x-shareasale-authentication');
  if (!timestamp || !provided) return { ok: false, reason: 'missing_signature' };

  // ±300s drift guard — defends against replay with stale captures.
  const ts = Date.parse(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad_timestamp' };
  if (Math.abs(Date.now() - ts) > 300_000) return { ok: false, reason: 'stale_timestamp' };

  const url = new URL(req.url);
  const signed = `${secret}:${timestamp}:${req.method}:${url.pathname}`;
  const expected = await hmacSha256Hex(secret, signed);
  return timingSafeEqual(expected, provided.toLowerCase())
    ? { ok: true }
    : { ok: false, reason: 'bad_signature' };
}

function verifyCj(req: Request): VerifyResult {
  const raw = Deno.env.get('CJ_ALLOWED_IPS');
  if (!raw) return { ok: false, reason: 'cj_allowlist_not_configured' };
  const allow = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const ip = clientIpFrom(req);
  if (!ip) return { ok: false, reason: 'no_client_ip' };
  // Exact match only — CIDR evaluation is out of scope; CJ publishes a small
  // list of gateway IPs. If that ever changes, add a CIDR library.
  return allow.includes(ip) ? { ok: true } : { ok: false, reason: 'ip_not_allowlisted' };
}

function verifyDirect(req: Request): VerifyResult {
  const expected = Deno.env.get('PERKS_WEBHOOK_SECRET');
  if (!expected) return { ok: false, reason: 'direct_secret_not_configured' };
  const provided = req.headers.get('x-village-webhook-token');
  if (!provided) return { ok: false, reason: 'missing_token' };
  return timingSafeEqual(expected, provided)
    ? { ok: true }
    : { ok: false, reason: 'bad_token' };
}

type Network = 'impact' | 'shareasale' | 'cj' | 'direct';

async function verify(network: Network, req: Request, rawBody: string): Promise<VerifyResult> {
  switch (network) {
    case 'impact':     return await verifyImpact(req, rawBody);
    case 'shareasale': return await verifyShareASale(req);
    case 'cj':         return verifyCj(req);
    case 'direct':     return verifyDirect(req);
    default:           return { ok: false, reason: 'unknown_network' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: CORS });
  }

  // Read raw body once — Impact needs exact bytes for HMAC, the rest need JSON.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_body' }), {
      status: 400, headers: { ...CORS, 'content-type': 'application/json' },
    });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...CORS, 'content-type': 'application/json' },
    });
  }

  const network = (parsed.network as Network | undefined) ?? 'direct';
  if (!['impact', 'shareasale', 'cj', 'direct'].includes(network)) {
    return new Response(JSON.stringify({ error: 'unknown_network' }), {
      status: 400, headers: { ...CORS, 'content-type': 'application/json' },
    });
  }

  const check = await verify(network, req, rawBody);
  if (!check.ok) {
    // Log the reason for ops triage but never echo it to the caller — that
    // leaks which check failed to an attacker probing the endpoint.
    console.warn('[perks-redemption-webhook] reject', { network, reason: check.reason });
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { ...CORS, 'content-type': 'application/json' },
    });
  }

  try {
    const {
      subid,
      network_order_id,
      converted_amount_cents,
      status = 'confirmed',
    } = parsed as {
      subid?: string;
      network_order_id?: string;
      converted_amount_cents?: number;
      status?: 'confirmed' | 'expired';
    };

    if (!subid || !network_order_id) {
      return new Response(JSON.stringify({ error: 'subid and network_order_id required' }), {
        status: 400, headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    if (status !== 'confirmed' && status !== 'expired') {
      return new Response(JSON.stringify({ error: 'invalid status' }), {
        status: 400, headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Match on subid (unique per click) — idempotent on repeated webhooks.
    const { data, error } = await supabase
      .from('deal_claims')
      .update({
        status,
        webhook_confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
        converted_amount_cents:
          typeof converted_amount_cents === 'number' ? converted_amount_cents : null,
        network_order_id,
      })
      .eq('subid', subid)
      .select('id')
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    if (!data) {
      // Could not find a claim — log, return 200 so the network doesn't retry forever.
      console.warn('[perks-redemption-webhook] subid not found', { network, subid });
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, matched: true, claim_id: data.id }), {
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'content-type': 'application/json' },
    });
  }
});
