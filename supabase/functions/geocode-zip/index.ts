// geocode-zip — resolve a US ZIP to its centroid, cache-first.
// POST /functions/v1/geocode-zip  { "zip": "33133" }
//
// WHY THIS EXISTS: every "near me" surface in the app funnels through
// getEffectiveCoords(), which returned HARDCODED MIAMI COORDS whenever GPS was
// denied or unavailable. We already collect `users.zip_code` at onboarding, so
// a mother who declines the location prompt should get results near HER ZIP
// rather than near downtown Miami. This is the lookup that makes that possible.
//
// Cache-first by design: each distinct ZIP costs at most one Google Geocoding
// call, ever. The zip_centroids table (migration 117) starts empty and fills
// on demand — we deliberately do not ship a bundled centroid list, because
// hand-entered coordinates are unverifiable and go stale.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_MAPS_API_KEY
// (same key events-geocode already uses).
//
// Auth: verify_jwt is on, so callers are signed-in users. The function does
// not read any user data — it takes a ZIP and returns public postal coords.

import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { getCallerUserId } from '../_shared/user-auth.ts';
import { consumeQuota, tooManyRequests } from '../_shared/rate-limit.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const GOOGLE_MAPS_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

// Accepts "33133", "33133-1234", " 33133 " → "33133". Returns null when the
// input can't be a US ZIP, so we never spend a geocode call on garbage.
function normalizeZip(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '');
  return digits.length >= 5 ? digits.slice(0, 5) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // AUTH (2026-09-04): no authorization check existed here. `verify_jwt = true` is
  // not one — the anon publishable key ships in the mobile bundle and satisfies the
  // gateway, so this was open to the internet. Resolves a ZIP to a centroid via the Google Geocoding API — a billable call, previously invocable by anyone holding the anon key.
  //
  // Only caller is the mobile app as a signed-in user, which already sends her JWT
  // via supabase.functions.invoke, so requiring a real user breaks nothing.
  //
  // This function does not act on a specific user's records, so proving "a valid
  // user is asking" is the right bar. Anything that reads or writes a particular
  // user's data must use getCallerUserId and compare ids instead.
  const callerId = await getCallerUserId(req);
  if (!callerId) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Per-user quota (migration 135 + _shared/rate-limit.ts). The gate above says
  // WHO is calling; this says HOW MUCH they may have. Without it one real account
  // could loop this endpoint and bill Villie without limit. Decided atomically in
  // SQL, so concurrent requests cannot all pass the same check. Fails OPEN on a
  // ledger error — this is a cost control, and a DB blip must not block a mother
  // mid-flow.
  const quota = await consumeQuota(callerId, 'geocode-zip');
  if (!quota.allowed) return tooManyRequests(quota, CORS);
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const zip = normalizeZip((body as any)?.zip);
  if (!zip) return json({ error: 'invalid_zip', detail: 'Expected a 5-digit US ZIP.' }, 400);

  // 1. Cache hit — the common path once a ZIP has been seen once.
  const { data: cached } = await supabase
    .from('zip_centroids')
    .select('zip, lat, lng, city, state')
    .eq('zip', zip)
    .maybeSingle();
  if (cached) return json({ ok: true, cached: true, ...cached });

  if (!GOOGLE_MAPS_KEY) {
    // Degrade honestly rather than inventing a coordinate. The client falls
    // back to its own default when this returns not-found.
    return json({ ok: false, error: 'geocoder_not_configured' }, 503);
  }

  // 2. Miss — ask Google. `components` constrains the match to a US postal
  // code, so "33133" can't resolve to a street address or a foreign postcode.
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('components', `postal_code:${zip}|country:US`);
    url.searchParams.set('key', GOOGLE_MAPS_KEY);

    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    const data = await resp.json().catch(() => null);
    const top = (data as any)?.results?.[0];
    const loc = top?.geometry?.location;

    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
      return json({ ok: false, error: 'zip_not_found', zip, google_status: (data as any)?.status ?? null }, 404);
    }

    const components: Array<{ long_name: string; short_name: string; types: string[] }> =
      top.address_components ?? [];
    const city = components.find((c) => c.types.includes('locality'))?.long_name
      ?? components.find((c) => c.types.includes('sublocality'))?.long_name
      ?? null;
    const state = components.find((c) => c.types.includes('administrative_area_level_1'))?.short_name ?? null;

    // 3. Cache it. A write failure is non-fatal — the caller still gets coords,
    // we just pay for the lookup again next time.
    const { error: upsertErr } = await supabase.rpc('upsert_zip_centroid', {
      p_zip: zip, p_lat: loc.lat, p_lng: loc.lng, p_city: city, p_state: state,
    });
    if (upsertErr) console.error(`[geocode-zip] cache write failed for ${zip}:`, upsertErr.message);

    return json({ ok: true, cached: false, zip, lat: loc.lat, lng: loc.lng, city, state });
  } catch (e) {
    return json({ ok: false, error: 'geocoder_unreachable', detail: e instanceof Error ? e.message : String(e) }, 502);
  }
});
