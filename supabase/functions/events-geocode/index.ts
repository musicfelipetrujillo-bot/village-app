// V4 G2 — Event geocoding helper (Pass 2 of self-sustaining events ingest).
// POST /functions/v1/events-geocode
//
// Body modes:
//   { mode: 'all', limit?: number }              ← cron, default 50
//   { mode: 'event', event_id: '<uuid>' }        ← single (post-ingest hook)
//   { mode: 'address', address: '<text>' }       ← debug, no DB write
//
// Closes the Pass 1 skip path: ICS feeds frequently emit events with a
// text-only LOCATION ("Mount Sinai Medical Center, Miami Beach, FL") and
// no coordinates. The events table schema requires geo for type='local'
// (CHECK constraint local_has_location), so Pass 1 dropped those rows.
//
// This function calls Google Maps Geocoding API for any local-type event
// missing `location` (PostGIS Point). On success: writes location + city.
// On failure: leaves the row alone — Pass 1 already withheld it.
//
// Why Google: the Village stack already uses Google Maps + Places (per
// CLAUDE.md tech stack), so a key is in production. At ~50 ingested events/day
// the free tier (10K req/mo) is comfortable.
//
// Pass 3 (2026-04-27): Nominatim/OpenStreetMap fallback for ZERO_RESULTS,
// OVER_QUERY_LIMIT, and request errors. Nominatim has a strict 1 req/sec
// rate-limit and a "no heavy use" usage policy — we throttle the fallback
// path to ≤10 calls per invocation and require a descriptive User-Agent
// per their requirements. The fallback is a safety net, not the primary
// path; if you ever see fallback usage > 10% of geocodes the right move is
// to investigate the Google failures, not lean on Nominatim harder.
//
// Posture:
//   - Service-role only.
//   - Fail-soft: any error leaves the row unchanged. Never delete.
//   - Cache layer is the events table itself — once geocoded, never re-asked.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const GOOGLE_MAPS_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? '';

// Nominatim usage-policy requires a descriptive User-Agent identifying the
// app + a contact path. https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM_UA = 'TheVillageApp/1.0 (events-geocode; ops@thevillage.app)';
// Per-invocation cap on Nominatim calls — the free service is rate-limited
// at 1 req/sec and we ingest ~50 events/day, so this is more than enough
// belt-and-braces while protecting us if Google goes down completely.
const NOMINATIM_BUDGET_PER_INVOCATION = 10;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PendingEvent {
  id: string;
  venue_name: string | null;
  address: string | null;
  city: string | null;
}

interface GeocodeHit {
  lat: number;
  lng: number;
  formatted_address: string;
  city: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (!GOOGLE_MAPS_KEY) {
    return json({ error: 'GOOGLE_MAPS_API_KEY not configured' }, 503);
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    if (body.mode === 'address') {
      if (!body.address) return json({ error: 'address required' }, 400);
      const debugCtx: GeocodeCtx = { nominatimRemaining: NOMINATIM_BUDGET_PER_INVOCATION };
      const hit = await geocode(String(body.address), debugCtx);
      return json({ hit });
    }

    let candidates: PendingEvent[] = [];
    if (body.mode === 'event') {
      if (!body.event_id) return json({ error: 'event_id required' }, 400);
      const { data, error } = await supabase
        .from('events')
        .select('id, venue_name, address, city, type, needs_geocode')
        .eq('id', body.event_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'event not found' }, 404);
      // We trust the `needs_geocode` flag (migration 047) — the events
      // table stores a (0,0) Null-Island sentinel for ICS-ingested rows
      // pre-geocode, so a `location IS NOT NULL` check would skip them.
      if (data.type !== 'local' || data.needs_geocode === false) {
        return json({ skipped: true, reason: 'already-geocoded-or-not-local' });
      }
      candidates = [data as PendingEvent];
    } else {
      const limit = Math.min(Math.max(body.limit ?? 50, 1), 200);
      // Local events flagged needs_geocode=TRUE — set in upsert_ingested_event
      // (migration 047) when ICS payload had no coords. set_event_location
      // clears the flag once geocoded so the sweep won't reprocess them.
      const { data, error } = await supabase
        .from('events')
        .select('id, venue_name, address, city')
        .eq('type', 'local')
        .eq('needs_geocode', true)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      candidates = (data ?? []) as PendingEvent[];
    }

    const results: Array<{ event_id: string; status: string; lat?: number; lng?: number; provider?: string }> = [];
    // Per-invocation Nominatim budget — see NOMINATIM_BUDGET_PER_INVOCATION
    // header comment. Mutated by geocode() when it falls back.
    const ctx = { nominatimRemaining: NOMINATIM_BUDGET_PER_INVOCATION };
    for (const ev of candidates) {
      const queryParts = [ev.venue_name, ev.address, ev.city].filter(Boolean) as string[];
      const query = queryParts.join(', ').trim();
      if (!query) {
        results.push({ event_id: ev.id, status: 'no_query' });
        continue;
      }
      let hit: GeocodeHit | null;
      try {
        hit = await geocode(query, ctx);
      } catch (err) {
        console.error(`geocode failed ${ev.id}:`, (err as Error).message);
        results.push({ event_id: ev.id, status: 'geocode_error' });
        continue;
      }
      if (!hit) {
        results.push({ event_id: ev.id, status: 'no_match' });
        continue;
      }
      // PostGIS Point construction goes through SQL — write via raw RPC.
      // Supabase JS doesn't have a typed PostGIS helper, so we patch
      // city/address normally and run a small RPC for the geometry.
      const { error: rpcErr } = await supabase.rpc('set_event_location', {
        p_event_id: ev.id,
        p_lat: hit.lat,
        p_lng: hit.lng,
      });
      if (rpcErr) {
        console.error(`set_event_location ${ev.id}:`, rpcErr.message);
        results.push({ event_id: ev.id, status: 'db_error' });
        continue;
      }
      // Fill city only when the row didn't already have one.
      if (!ev.city && hit.city) {
        await supabase.from('events').update({ city: hit.city }).eq('id', ev.id);
      }
      results.push({ event_id: ev.id, status: 'ok', lat: hit.lat, lng: hit.lng });
    }

    return json({ processed: results.length, results });
  } catch (err) {
    console.error('events-geocode fatal:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

interface GeocodeCtx {
  nominatimRemaining: number;
}

// Top-level orchestrator. Tries Google first; on null/error/quota, falls
// through to Nominatim if any of `ctx.nominatimRemaining` budget is left.
// Throws only when BOTH providers error out — null means "neither found a
// match" (a normal outcome the caller records as `no_match`).
async function geocode(query: string, ctx: GeocodeCtx): Promise<GeocodeHit | null> {
  let googleErr: Error | null = null;
  try {
    const hit = await geocodeGoogle(query);
    if (hit) return hit;
    // Google returned ZERO_RESULTS — fall through to Nominatim.
  } catch (err) {
    // OVER_QUERY_LIMIT / network / 5xx — fall through to Nominatim. Keep the
    // error so we can re-raise if the fallback is also unavailable.
    googleErr = err as Error;
    console.warn(`google geocode error for "${query}":`, googleErr.message);
  }

  if (ctx.nominatimRemaining <= 0) {
    if (googleErr) throw googleErr;
    return null;
  }
  ctx.nominatimRemaining--;
  // Nominatim policy: ≤1 req/sec. We loop sequentially so a 1.1s pause
  // before each fallback call is sufficient — no token-bucket needed.
  await sleep(1100);
  try {
    return await geocodeNominatim(query);
  } catch (err) {
    console.warn(`nominatim geocode error for "${query}":`, (err as Error).message);
    if (googleErr) throw googleErr;
    return null;
  }
}

async function geocodeGoogle(query: string): Promise<GeocodeHit | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('key', GOOGLE_MAPS_KEY);

  const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`http_${resp.status}`);
  const data = await resp.json();
  // ZERO_RESULTS is a normal "no match" — return null, don't throw, so the
  // caller falls through to Nominatim cleanly. Throw only on quota / req
  // errors so the fallback path is reserved for actual provider trouble.
  if (data.status === 'ZERO_RESULTS') return null;
  if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED') {
    throw new Error(`google_${data.status.toLowerCase()}`);
  }
  if (data.status !== 'OK' || !data.results?.length) return null;

  const top = data.results[0];
  const loc = top.geometry?.location;
  if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') return null;

  // Pull city from address_components (Google's "locality" or "postal_town").
  const components: Array<{ long_name: string; types: string[] }> = top.address_components ?? [];
  const cityComp = components.find((c) => c.types.includes('locality'))
    ?? components.find((c) => c.types.includes('postal_town'))
    ?? components.find((c) => c.types.includes('sublocality'));

  return {
    lat: loc.lat,
    lng: loc.lng,
    formatted_address: top.formatted_address,
    city: cityComp?.long_name ?? null,
  };
}

// Nominatim (OpenStreetMap) fallback. Free service — usage policy at
// https://operations.osmfoundation.org/policies/nominatim/ requires a
// descriptive User-Agent and ≤1 req/sec. The budget cap in the caller
// keeps us well under any reasonable "heavy use" definition.
async function geocodeNominatim(query: string): Promise<GeocodeHit | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '1');

  const resp = await fetch(url.toString(), {
    headers: {
      'User-Agent': NOMINATIM_UA,
      'Accept-Language': 'en',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`http_${resp.status}`);
  const data = await resp.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const top = data[0];
  const lat = typeof top.lat === 'string' ? parseFloat(top.lat) : top.lat;
  const lng = typeof top.lon === 'string' ? parseFloat(top.lon) : top.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Nominatim's address fields vary by country — prefer city, then town,
  // then village, then suburb. Mirrors Google's locality > sublocality
  // preference order so downstream `city` is consistent across providers.
  const addr = top.address ?? {};
  const city = addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? addr.county ?? null;

  return {
    lat,
    lng,
    formatted_address: top.display_name ?? query,
    city,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
