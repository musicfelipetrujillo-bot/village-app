// daycares-nearby — Google Places-backed daycare discovery (MVP data source for
// the Care "daycare" tier). Returns name, rating, open-now, and distance for
// licensed-adjacent childcare centers near the mom. Places does NOT provide
// ages/price/licensing — those land in the later hybrid phase (state licensing
// DB). villie LISTS these; it does not endorse or vet them.
//
// Env: GOOGLE_MAPS_API_KEY (must have the Places API enabled + be server-usable).

import { createClient } from 'npm:@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Curated table coverage (Miami-Dade). Inside this box we serve the DCF registry
// rows (real license #, capacity); outside, we fall back to Google Places.
function inMiamiDade(lat: number, lng: number): boolean {
  return lat >= 25.0 && lat <= 26.05 && lng >= -80.95 && lng <= -80.05;
}

// Match one registry row to Google Places (by name + location bias) to add a
// ★rating + open-now. Fail-soft: on any error we keep the registry-only card.
async function enrichOne(r: DaycareResult): Promise<void> {
  if (!KEY) return;
  try {
    const u = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
    u.searchParams.set('input', r.name);
    u.searchParams.set('inputtype', 'textquery');
    u.searchParams.set('fields', 'rating,user_ratings_total,opening_hours');
    u.searchParams.set('locationbias', `point:${r.lat},${r.lng}`);
    u.searchParams.set('key', KEY);
    const res = await fetch(u.toString());
    const c = (await res.json())?.candidates?.[0];
    if (!c) return;
    if (typeof c.rating === 'number') r.rating = c.rating;
    if (typeof c.user_ratings_total === 'number') r.ratings_count = c.user_ratings_total;
    if (typeof c.opening_hours?.open_now === 'boolean') r.open_now = c.opening_hours.open_now;
  } catch { /* keep registry-only */ }
}

async function fetchMiamiDaycares(lat: number, lng: number, radiusMiles: number): Promise<DaycareResult[]> {
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await supa.rpc('list_daycares_near', { p_lat: lat, p_lng: lng, p_radius_miles: radiusMiles });
  if (error) throw new Error(error.message);
  const results: DaycareResult[] = ((data ?? []) as any[]).map((d) => ({
    place_id: d.id,
    name: d.name,
    address: [d.address, d.city].filter(Boolean).join(', '),
    distance_mi: typeof d.distance_mi === 'number' ? Math.round(d.distance_mi * 10) / 10 : 0,
    lat: d.lat, lng: d.lng,
    license_number: d.license_number ?? undefined,
    capacity: d.capacity ?? undefined,
    phone: d.phone ?? undefined,
    source: 'mdc_dcf',
  }));
  // Enrich the nearest ~12 (what she'll actually see) with Places ratings/hours.
  await Promise.all(results.slice(0, 12).map(enrichOne));
  return results;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? '';

function haversineMi(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export type DaycareResult = {
  place_id: string;
  name: string;
  address?: string;
  rating?: number;
  ratings_count?: number;
  open_now?: boolean;
  distance_mi: number;
  lat: number;
  lng: number;
  // Miami-Dade DCF registry fields (present only for source: 'mdc_dcf').
  license_number?: string;
  capacity?: number;
  phone?: string;
  source?: 'mdc_dcf' | 'places';
};

// Shared so the assistant's find_daycares tool can reuse the exact logic.
export async function fetchDaycares(lat: number, lng: number, radiusMiles: number): Promise<DaycareResult[]> {
  if (!KEY) throw new Error('GOOGLE_MAPS_API_KEY not configured');
  // rankby=distance returns the nearest first (ignores radius), so we fetch then
  // filter to the requested radius ourselves.
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('rankby', 'distance');
  url.searchParams.set('keyword', 'daycare child care');
  url.searchParams.set('key', KEY);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`places_${String(data.status).toLowerCase()}`);
  }
  const rows = (data.results ?? []) as any[];
  return rows
    .filter((r) => r.business_status ? r.business_status === 'OPERATIONAL' : true)
    .map((r) => {
      const pLat = r.geometry?.location?.lat, pLng = r.geometry?.location?.lng;
      return {
        place_id: r.place_id,
        name: r.name,
        address: r.vicinity,
        rating: typeof r.rating === 'number' ? r.rating : undefined,
        ratings_count: typeof r.user_ratings_total === 'number' ? r.user_ratings_total : undefined,
        open_now: r.opening_hours?.open_now,
        distance_mi: (typeof pLat === 'number' && typeof pLng === 'number') ? Math.round(haversineMi(lat, lng, pLat, pLng) * 10) / 10 : 0,
        lat: pLat, lng: pLng,
      } as DaycareResult;
    })
    .filter((r) => r.distance_mi <= radiusMiles + 0.1)
    .slice(0, 20);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const body = await req.json();
    const lat = Number(body.lat), lng = Number(body.lng);
    const radiusMiles = Number(body.radius_miles) || 10;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: 'lat/lng required' }, 400);
    // Miami-Dade → curated DCF registry (real license #); elsewhere → Places.
    if (inMiamiDade(lat, lng)) {
      const miami = await fetchMiamiDaycares(lat, lng, radiusMiles);
      if (miami.length) return json({ count: miami.length, results: miami, source: 'mdc_dcf' });
      // No curated rows in range (edge of the county) → fall through to Places.
    }
    const results = await fetchDaycares(lat, lng, radiusMiles);
    return json({ count: results.length, results, source: 'places' });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
