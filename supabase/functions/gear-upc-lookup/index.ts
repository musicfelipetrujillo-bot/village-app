// V4 Phase G5 — UPC product lookup (waterfall).
//
// POST /functions/v1/gear-upc-lookup
// Body: { upc: string }
// Returns: { found: boolean, source?: 'go-upc' | 'upcitemdb',
//            name?: string, brand?: string, msrp_cents?: number,
//            image_url?: string, category_hint?: string }
//
// Waterfall:
//   1. Go-UPC (primary)   — GO_UPC_API_KEY env
//   2. UPCitemdb (backup) — UPCITEMDB_API_KEY env (optional)
// If neither key is set we return { found: false } with a 200 so the mobile
// flow gracefully degrades to manual entry.

import { isAuthenticatedUser } from '../_shared/user-auth.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TIMEOUT_MS = 5000;

interface Body { upc?: string; }

interface LookupResult {
  found: boolean;
  source?: 'go-upc' | 'upcitemdb';
  name?: string;
  brand?: string;
  msrp_cents?: number;
  image_url?: string;
  category_hint?: string;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const ctl = new AbortController();
  const tid = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.json();
  } finally { clearTimeout(tid); }
}

async function lookupGoUpc(upc: string, apiKey: string): Promise<LookupResult> {
  // Docs: https://go-upc.com/api
  const url = `https://go-upc.com/api/v1/code/${encodeURIComponent(upc)}`;
  const data = await fetchJson(url, { headers: { Authorization: `Bearer ${apiKey}` } }) as {
    product?: {
      name?: string;
      brand?: string;
      imageUrl?: string;
      category?: string;
      description?: string;
      region?: string;
      specs?: Array<[string, string]>;
    };
  };
  if (!data.product || !data.product.name) return { found: false };
  const p = data.product;
  return {
    found: true,
    source: 'go-upc',
    name: p.name,
    brand: p.brand || undefined,
    image_url: p.imageUrl || undefined,
    category_hint: p.category || undefined,
  };
}

async function lookupUpcItemDb(upc: string, apiKey: string): Promise<LookupResult> {
  // Docs: https://www.upcitemdb.com/wp/docs/main/development/responses/
  const url = `https://api.upcitemdb.com/prod/v1/lookup?upc=${encodeURIComponent(upc)}`;
  const data = await fetchJson(url, { headers: { user_key: apiKey } }) as {
    items?: Array<{
      title?: string;
      brand?: string;
      category?: string;
      images?: string[];
      highest_recorded_price?: number;
      lowest_recorded_price?: number;
    }>;
  };
  const item = data.items?.[0];
  if (!item || !item.title) return { found: false };
  const msrp = typeof item.highest_recorded_price === 'number' && item.highest_recorded_price > 0
    ? Math.round(item.highest_recorded_price * 100)
    : undefined;
  return {
    found: true,
    source: 'upcitemdb',
    name: item.title,
    brand: item.brand || undefined,
    image_url: item.images?.[0] || undefined,
    category_hint: item.category || undefined,
    msrp_cents: msrp,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // AUTH (2026-09-04): no authorization check existed here. `verify_jwt = true` is
  // not one — the anon publishable key ships in the mobile bundle and satisfies the
  // gateway, so this was open to the internet. Calls the Go-UPC / UPCitemdb APIs —
  // billable third-party lookups, previously invocable by anyone holding that key.
  //
  // Only caller is the mobile app as a signed-in user (api/gear.ts:307), which
  // already sends her JWT via supabase.functions.invoke, so this breaks nothing.
  //
  // This function does not act on a specific user's records, so proving "a valid
  // user is asking" is the right bar. Anything that reads or writes a particular
  // user's data must use getCallerUserId and compare ids instead.
  if (!(await isAuthenticatedUser(req))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body: Body;
  try { body = await req.json() as Body; }
  catch { return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }); }

  const upc = body.upc?.trim().replace(/\D/g, '');
  if (!upc || upc.length < 8) {
    return new Response(JSON.stringify({ error: 'invalid upc' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const GO_UPC = Deno.env.get('GO_UPC_API_KEY');
  const UPCITEMDB = Deno.env.get('UPCITEMDB_API_KEY');

  // Neither configured — graceful empty response.
  if (!GO_UPC && !UPCITEMDB) {
    return new Response(JSON.stringify({ found: false, reason: 'no_api_keys' } satisfies LookupResult & { reason: string }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (GO_UPC) {
      const first = await lookupGoUpc(upc, GO_UPC);
      if (first.found) {
        return new Response(JSON.stringify(first), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }
    if (UPCITEMDB) {
      const second = await lookupUpcItemDb(upc, UPCITEMDB);
      if (second.found) {
        return new Response(JSON.stringify(second), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({ found: false } satisfies LookupResult), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[upc-lookup] error', err);
    return new Response(JSON.stringify({ found: false, error: 'lookup failed' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
