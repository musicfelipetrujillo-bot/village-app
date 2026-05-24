// V4 Phase G5 — Gear price suggestion.
//
// POST /functions/v1/gear-price-suggest
// Body: { category: string, condition: 'new'|'like_new'|'good'|'fair',
//         brand?: string, model?: string, year_manufactured?: number,
//         locale?: 'en'|'es' }
// Returns: {
//   suggested_low: number, suggested_mid: number, suggested_high: number,
//   currency: 'USD',
//   source: 'ebay' | 'heuristic',
//   confidence: 'low' | 'med' | 'high',
//   notes: string,
//   sample_count?: number   // only on source='ebay'
// }
//
// LIFECYCLE: this function ships as a HEURISTIC-ONLY scaffold until the
// eBay Developer credentials land (waiting on app approval as of
// 2026-05-15 — see CLAUDE.md memory note "eBay API: waiting on
// Developer account approval"). When `EBAY_APP_ID` is present in the
// Edge Function Secrets, the function automatically promotes to the
// real eBay Browse API path. Mobile callers don't need to change —
// the response contract is stable, only `source` flips from
// `'heuristic'` to `'ebay'` and `sample_count` starts appearing.
//
// The heuristic table is calibrated against Facebook Marketplace +
// Mercari spot-checks for a Northeast metro (Brooklyn / Jersey City
// / Philly). It's intentionally conservative — recommending too HIGH
// would generate complaints when listings don't sell; too LOW costs
// the seller money. We err low.
//
// Mobile UX intent: as a non-blocking hint on CreateListingScreen
// after the user picks category + condition. Render as an amber
// pill ("Similar items go for $20–$35 → use $25?") with a tap-to-fill
// affordance. Never auto-fill or block submit.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Mirrors the allowlist CHECK in migration 012. Anything outside this
// list returns a 400 — keeps the heuristic + eBay paths in step with
// the DB constraint.
type GearCategory =
  | 'stroller' | 'carrier_wrap' | 'high_chair' | 'bouncer_swing' | 'toy'
  | 'feeding_gear' | 'clothing' | 'book' | 'activity_center'
  | 'nursery_furniture';

type GearCondition = 'new' | 'like_new' | 'good' | 'fair';

const CATEGORY_BASE: Record<GearCategory, number> = {
  stroller:           80,   // high variance — calibrate against eBay when key lands
  carrier_wrap:       35,
  high_chair:         60,
  bouncer_swing:      45,
  toy:                12,
  feeding_gear:       15,
  clothing:            8,
  book:                5,
  activity_center:    50,
  nursery_furniture: 120,
};

// Used-market discount vs new-retail. Caps below 1 even for 'new' since
// the used-resale market never pays MSRP for unopened baby gear.
const CONDITION_MULT: Record<GearCondition, number> = {
  new:      0.80,
  like_new: 0.65,
  good:     0.50,
  fair:     0.32,
};

// Premium brands lift the base ~25%. Conservative list — we'd rather
// under-suggest than misclassify. Wire to a richer brand catalog when
// eBay data lands.
const PREMIUM_BRANDS = new Set([
  'uppababy', 'bugaboo', 'cybex', 'nuna', 'doona',
  'stokke', 'babybjorn', 'baby björn', 'mockingbird',
  'maxi-cosi', 'maxi cosi', 'silver cross', 'pottery barn kids',
  'restoration hardware', 'rh baby', 'crate & kids',
]);

function ageDiscount(yearManufactured?: number): number {
  if (!yearManufactured) return 0.85;            // unknown age — assume mid-life
  const now = new Date().getFullYear();
  const age = Math.max(0, now - yearManufactured);
  if (age <= 1)  return 1.00;
  if (age <= 3)  return 0.90;
  if (age <= 5)  return 0.80;
  if (age <= 8)  return 0.65;
  return 0.50;
}

function brandMultiplier(brand?: string): number {
  if (!brand) return 1.0;
  return PREMIUM_BRANDS.has(brand.trim().toLowerCase()) ? 1.25 : 1.0;
}

function buildHeuristic(
  category: GearCategory,
  condition: GearCondition,
  brand?: string,
  year_manufactured?: number,
): {
  suggested_low: number; suggested_mid: number; suggested_high: number;
  notes: string;
} {
  const base = CATEGORY_BASE[category];
  const mult = CONDITION_MULT[condition]
             * ageDiscount(year_manufactured)
             * brandMultiplier(brand);
  const mid = Math.max(3, Math.round(base * mult));
  // Spread ±25% around the midpoint. Round to nearest dollar.
  const low  = Math.max(3, Math.round(mid * 0.75));
  const high = Math.round(mid * 1.25);
  const noteBits: string[] = [];
  noteBits.push(`Based on ${category.replace(/_/g, ' ')} in ${condition.replace('_', ' ')} condition`);
  if (brand && brandMultiplier(brand) > 1) noteBits.push(`premium brand`);
  if (year_manufactured) noteBits.push(`${new Date().getFullYear() - year_manufactured} yr old`);
  return {
    suggested_low: low,
    suggested_mid: mid,
    suggested_high: high,
    notes: noteBits.join(' · '),
  };
}

// ─── eBay Browse API — promoted-to-live when EBAY_APP_ID is set ──────
// Reference: https://developer.ebay.com/api-docs/buy/browse/overview.html
// Endpoint: GET /buy/browse/v1/item_summary/search?q=...&filter=...
// Auth: Application access token (client_credentials OAuth flow). We
// cache the token in-memory per cold-start since they live 2 hours.
let cachedEbayToken: { token: string; expiresAt: number } | null = null;

async function getEbayAppToken(appId: string, certId: string): Promise<string | null> {
  const now = Date.now();
  if (cachedEbayToken && cachedEbayToken.expiresAt > now + 60_000) {
    return cachedEbayToken.token;
  }
  try {
    const basic = btoa(`${appId}:${certId}`);
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });
    if (!res.ok) {
      console.warn('ebay token fetch failed', res.status, await res.text());
      return null;
    }
    const json: any = await res.json();
    cachedEbayToken = {
      token: json.access_token as string,
      expiresAt: now + (Number(json.expires_in ?? 7200) * 1000),
    };
    return cachedEbayToken.token;
  } catch (e) {
    console.warn('ebay token exception', e);
    return null;
  }
}

async function fetchEbayComps(
  token: string, query: string, condition: GearCondition,
): Promise<{ low: number; mid: number; high: number; count: number } | null> {
  // eBay condition IDs (https://developer.ebay.com/devzone/guides/ebayfeatures/Development/Desc-ItemCondition.html):
  //   1000 = New, 1500 = New Other, 2000 = Manufacturer refurbished,
  //   3000 = Used, 4000 = Very Good, 5000 = Good, 6000 = Acceptable, 7000 = For parts
  const conditionFilter: Record<GearCondition, string> = {
    new:      '1000|1500',
    like_new: '2000|2500|3000',
    good:     '4000|5000',
    fair:     '6000|7000',
  };
  try {
    const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
    url.searchParams.set('q', query);
    url.searchParams.set('filter', `conditionIds:{${conditionFilter[condition]}},itemLocationCountry:US,buyingOptions:{FIXED_PRICE}`);
    url.searchParams.set('limit', '40');
    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Accept-Language': 'en-US',
      },
    });
    if (!res.ok) {
      console.warn('ebay search failed', res.status, await res.text());
      return null;
    }
    const json: any = await res.json();
    const prices: number[] = (json.itemSummaries ?? [])
      .map((it: any) => Number(it?.price?.value))
      .filter((n: number) => Number.isFinite(n) && n > 0 && n < 5000);
    if (prices.length < 4) return null;
    prices.sort((a, b) => a - b);
    const p25 = prices[Math.floor(prices.length * 0.25)];
    const p50 = prices[Math.floor(prices.length * 0.50)];
    const p75 = prices[Math.floor(prices.length * 0.75)];
    return {
      low:  Math.round(p25),
      mid:  Math.round(p50),
      high: Math.round(p75),
      count: prices.length,
    };
  } catch (e) {
    console.warn('ebay search exception', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Require a valid Supabase user JWT — anon callers can't get pricing
  // (keeps the eBay quota tied to real product usage). Mobile clients
  // forward their bearer token automatically via supabase.functions.invoke.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return new Response(JSON.stringify({ error: 'auth required' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'invalid session' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Parse + validate input
  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'invalid json' }), {
    status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
  }); }

  const category = body?.category as GearCategory;
  const condition = body?.condition as GearCondition;
  const brand = typeof body?.brand === 'string' ? body.brand : undefined;
  const model = typeof body?.model === 'string' ? body.model : undefined;
  const year_manufactured = Number.isFinite(body?.year_manufactured)
    ? Number(body.year_manufactured) : undefined;

  if (!(category in CATEGORY_BASE)) {
    return new Response(JSON.stringify({ error: 'invalid category' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (!(condition in CONDITION_MULT)) {
    return new Response(JSON.stringify({ error: 'invalid condition' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Try eBay if keys are present — otherwise fall through to heuristic.
  const ebayAppId = Deno.env.get('EBAY_APP_ID');
  const ebayCertId = Deno.env.get('EBAY_CERT_ID');
  if (ebayAppId && ebayCertId) {
    const token = await getEbayAppToken(ebayAppId, ebayCertId);
    if (token) {
      const queryBits = [brand, model, category.replace(/_/g, ' ')].filter(Boolean).join(' ');
      const comps = await fetchEbayComps(token, queryBits, condition);
      if (comps) {
        return new Response(JSON.stringify({
          suggested_low: comps.low,
          suggested_mid: comps.mid,
          suggested_high: comps.high,
          currency: 'USD',
          source: 'ebay',
          confidence: comps.count >= 12 ? 'high' : 'med',
          notes: `Based on ${comps.count} recent US eBay sales · ${category.replace(/_/g, ' ')} · ${condition.replace('_', ' ')}`,
          sample_count: comps.count,
        }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      // eBay returned too few comps — fall through to heuristic with a note.
    }
  }

  const h = buildHeuristic(category, condition, brand, year_manufactured);
  return new Response(JSON.stringify({
    suggested_low: h.suggested_low,
    suggested_mid: h.suggested_mid,
    suggested_high: h.suggested_high,
    currency: 'USD',
    source: 'heuristic',
    confidence: 'low',
    notes: h.notes,
  }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
});
