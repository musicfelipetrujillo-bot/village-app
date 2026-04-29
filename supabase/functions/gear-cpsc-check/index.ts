// V4 Phase G5 — CPSC Recall check.
//
// POST /functions/v1/gear-cpsc-check
// Body: { product_name: string, brand?: string, upc?: string, listing_id?: string }
// Returns: { status: 'clear' | 'recalled' | 'unknown',
//            recall?: { recall_number, title, hazard, remedy, recall_date, url } }
//
// Flow:
//   1. If the request carries a UPC → try local cpsc_recall_cache by UPC first
//      (cheap, no network). If hit, return recalled.
//   2. Query SaferProducts.gov Recall API by RecallTitle + (optional brand) and,
//      if UPC present, by UPC as a secondary filter. We use the public JSON API —
//      no key needed.
//   3. If a recall matches, write it into cpsc_recall_cache (service role) so
//      the nightly sweep and future lookups are cheap.
//   4. If listing_id is provided AND the caller is authenticated, flip the
//      listing's cpsc_recall_status via the mark_listing_cpsc RPC (owner-scoped).
//
// Safety posture:
//   * On API timeout / network error we return { status: 'unknown' } with a 200
//     and DO NOT mark the listing. The UI treats unknown as "show a soft notice,
//     don't ship the CPSC Checked ✓ badge, don't block" — falling open vs the
//     recall database is acceptable because the nightly sweep will catch it;
//     falling closed (blocking every new listing whenever CPSC is down) is not.
//   * If the caller is anonymous (no Authorization), we still return the verdict
//     — CreateListingScreen wants the verdict before it even has a listing row
//     in some UX variants. But we won't write to the listing.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SAFER_PRODUCTS_URL = 'https://www.saferproducts.gov/RestWebServices/Recall';
const REQUEST_TIMEOUT_MS = 6000;

interface Body {
  product_name?: string;
  brand?: string | null;
  upc?: string | null;
  listing_id?: string | null;
}

interface RecallHit {
  recall_number: string;
  title: string;
  description?: string | null;
  hazard?: string | null;
  remedy?: string | null;
  recall_date?: string | null;
  url?: string | null;
  upcs: string[];
  brand_lc?: string | null;
  product_name_lc?: string | null;
}

// CPSC JSON shape (subset we care about).
interface CPSCRecall {
  RecallID?: number;
  RecallNumber?: string;
  RecallDate?: string;
  Title?: string;
  Description?: string;
  URL?: string;
  Products?: Array<{
    Name?: string;
    Description?: string;
    Model?: string;
    Type?: string;
    CategoryID?: string;
    NumberOfUnits?: string;
    UPCs?: string[];
  }>;
  Manufacturers?: Array<{ Name?: string }>;
  Hazards?: Array<{ Name?: string; HazardType?: string }>;
  Remedies?: Array<{ Name?: string; Options?: Array<{ Name?: string }> }>;
  Images?: Array<{ URL?: string }>;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const tid = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
  } finally {
    clearTimeout(tid);
  }
}

function normalize(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  return t.length > 0 ? t : null;
}

function toRecallHit(r: CPSCRecall): RecallHit | null {
  const num = r.RecallNumber?.trim();
  const title = r.Title?.trim();
  if (!num || !title) return null;
  const upcs: string[] = [];
  for (const p of r.Products ?? []) {
    for (const u of p.UPCs ?? []) {
      const clean = String(u).replace(/\D/g, '');
      if (clean.length >= 8) upcs.push(clean);
    }
  }
  const brand = r.Manufacturers?.[0]?.Name ?? null;
  const productName = r.Products?.[0]?.Name ?? null;
  const hazard = r.Hazards?.map((h) => h.Name).filter(Boolean).join('; ') || null;
  const remedy = r.Remedies?.map((rm) => rm.Name).filter(Boolean).join('; ') || null;
  return {
    recall_number: num,
    title,
    description: r.Description ?? null,
    hazard,
    remedy,
    recall_date: r.RecallDate ? r.RecallDate.slice(0, 10) : null,
    url: r.URL ?? null,
    upcs,
    brand_lc: normalize(brand),
    product_name_lc: normalize(productName),
  };
}

async function queryCPSC(params: { productName?: string; brand?: string; upc?: string }): Promise<RecallHit[]> {
  const q = new URLSearchParams({ format: 'json' });
  if (params.productName) q.set('RecallTitle', params.productName);
  if (params.upc) q.set('UPC', params.upc);
  const url = `${SAFER_PRODUCTS_URL}?${q.toString()}`;
  const res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
  if (!res.ok) throw new Error(`cpsc ${res.status}`);
  const data = await res.json() as CPSCRecall[] | { Recalls?: CPSCRecall[] };
  const arr: CPSCRecall[] = Array.isArray(data) ? data : data.Recalls ?? [];
  const hits = arr.map(toRecallHit).filter((h): h is RecallHit => h !== null);

  // Secondary brand filter — the CPSC API does not accept Manufacturer as a
  // first-class query param, so we narrow client-side.
  if (params.brand) {
    const brandLc = normalize(params.brand);
    return hits.filter((h) => !h.brand_lc || h.brand_lc === brandLc);
  }
  return hits;
}

async function upsertCache(
  admin: ReturnType<typeof createClient>,
  hit: RecallHit,
): Promise<void> {
  const { error } = await admin.from('cpsc_recall_cache').upsert({
    recall_number: hit.recall_number,
    title: hit.title,
    description: hit.description,
    hazard: hit.hazard,
    remedy: hit.remedy,
    recall_date: hit.recall_date,
    recall_url: hit.url,
    product_name_lc: hit.product_name_lc,
    brand_lc: hit.brand_lc,
    upcs: hit.upcs,
    cpsc_categories: [],
  }, { onConflict: 'recall_number' });
  if (error) console.error('[cpsc-check] cache upsert', error);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  let body: Body;
  try { body = await req.json() as Body; }
  catch { return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }); }

  const productName = body.product_name?.trim() ?? '';
  const brand = body.brand?.trim() || undefined;
  const upc = body.upc?.trim().replace(/\D/g, '') || undefined;

  if (!productName && !upc) {
    return new Response(JSON.stringify({ error: 'product_name or upc required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // ── 1. cache-first lookup by UPC (strongest signal) ───────────────────────
    if (upc) {
      const { data: cacheHits } = await admin
        .from('cpsc_recall_cache')
        .select('recall_number,title,hazard,remedy,recall_date,recall_url')
        .contains('upcs', [upc])
        .limit(1);
      if (cacheHits && cacheHits.length > 0) {
        const c = cacheHits[0] as {
          recall_number: string; title: string;
          hazard: string | null; remedy: string | null;
          recall_date: string | null; recall_url: string | null;
        };
        await maybePersist(req, SUPABASE_URL, ANON_KEY, body.listing_id, 'recalled', c.recall_number, c.recall_url);
        return new Response(JSON.stringify({
          status: 'recalled',
          recall: {
            recall_number: c.recall_number,
            title: c.title,
            hazard: c.hazard,
            remedy: c.remedy,
            recall_date: c.recall_date,
            url: c.recall_url,
          },
        }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    // ── 2. live CPSC query ───────────────────────────────────────────────────
    const hits = await queryCPSC({ productName, brand, upc });
    if (hits.length > 0) {
      const top = hits[0];
      await upsertCache(admin, top);
      await maybePersist(req, SUPABASE_URL, ANON_KEY, body.listing_id, 'recalled', top.recall_number, top.url ?? null);
      return new Response(JSON.stringify({
        status: 'recalled',
        recall: {
          recall_number: top.recall_number,
          title: top.title,
          hazard: top.hazard,
          remedy: top.remedy,
          recall_date: top.recall_date,
          url: top.url,
        },
      }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // ── 3. clear ──────────────────────────────────────────────────────────────
    await maybePersist(req, SUPABASE_URL, ANON_KEY, body.listing_id, 'clear', null, null);
    return new Response(JSON.stringify({ status: 'clear' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[cpsc-check] error', err);
    // Fail-open-but-unverified — see safety note at top.
    return new Response(JSON.stringify({
      status: 'unknown',
      error: 'cpsc lookup unavailable',
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// maybePersist — if caller is authenticated AND provided a listing_id, flip the
// listing's CPSC status using the user's own JWT (so RLS applies).
// ─────────────────────────────────────────────────────────────────────────────
async function maybePersist(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
  listingId: string | null | undefined,
  status: 'clear' | 'recalled' | 'unknown',
  recallId: string | null,
  recallUrl: string | null,
) {
  if (!listingId) return;
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { error } = await userClient.rpc('mark_listing_cpsc', {
    p_listing_id: listingId,
    p_status: status,
    p_recall_id: recallId,
    p_recall_url: recallUrl,
  });
  if (error) console.error('[cpsc-check] mark_listing_cpsc', error);
}
