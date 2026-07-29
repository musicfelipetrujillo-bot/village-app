import type { Loc, ToolContext, ToolDef } from './types.ts';
import { num } from './_util.ts';

const GOOGLE_MAPS_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? '';
function haversineMi(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function inMiamiDade(lat: number, lng: number): boolean {
  return lat >= 25.0 && lat <= 26.05 && lng >= -80.95 && lng <= -80.05;
}

async function run(supabase: any, loc: Loc) {
  if (!loc) return { need_location: true };
  // Miami-Dade → curated DCF registry (real license #); elsewhere → Places.
  if (inMiamiDade(loc.lat, loc.lng)) {
    const { data, error } = await supabase.rpc('list_daycares_near', { p_lat: loc.lat, p_lng: loc.lng, p_radius_miles: 10 });
    if (!error && (data ?? []).length) {
      return {
        count: data.length,
        source: 'miami_dade_dcf_registry',
        results: (data as any[]).slice(0, 6).map((d) => ({
          name: d.name,
          distance_mi: num(d.distance_mi),
          license_number: d.license_number ?? undefined,
          capacity: d.capacity ?? undefined,
          address: [d.address, d.city].filter(Boolean).join(', '),
        })),
        note: 'from the Miami-Dade DCF daycare registry — real license #, but tell her to verify CURRENT status on CARES; villie does not endorse/vet; ages + price coming soon',
      };
    }
  }
  if (!GOOGLE_MAPS_KEY) return { error: 'daycare_lookup_unavailable' };
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${loc.lat},${loc.lng}`);
  url.searchParams.set('rankby', 'distance');
  url.searchParams.set('keyword', 'daycare child care');
  url.searchParams.set('key', GOOGLE_MAPS_KEY);
  const res = await fetch(url.toString());
  const data = await res.json();
  const rows = (data.results ?? []) as any[];
  return {
    count: rows.length,
    results: rows.slice(0, 6).map((r) => ({
      name: r.name,
      rating: typeof r.rating === 'number' ? num(r.rating) : undefined,
      open_now: r.opening_hours?.open_now,
      distance_mi: r.geometry?.location ? num(haversineMi(loc.lat, loc.lng, r.geometry.location.lat, r.geometry.location.lng)) : undefined,
      address: r.vicinity,
    })),
    note: 'public listings — villie does not endorse/vet; ages, price, licensing coming soon',
  };
}

export const findDaycares: ToolDef = {
  tier: 'read',
  schema: {
    name: 'find_daycares',
    description: "Find daycare / childcare centers near the mom (from public Google listings) and return top matches (name, rating, open-now, distance). Use when she asks about daycares or childcare centers, e.g. 'daycares within 5 miles'. In your reply, note these are public listings — villie lists but does NOT endorse or vet them — and that licensing badges, ages, and price are coming soon. Returns need_location:true if location is unavailable.",
    input_schema: { type: 'object', properties: {} },
  },
  handler: (ctx: ToolContext, _input: any) => run(ctx.supabase, ctx.loc),
};
