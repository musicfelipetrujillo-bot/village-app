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

// School-age aftercare licenses (hosted at elementary/middle/high schools)
// pollute the 0-12-month audience — drop them from every source. Mirrors
// daycares-nearby (can't import it: its module body calls Deno.serve).
const SCHOOL_RE = /(middle school|high school|elementary|k-8|k 8|junior high|senior high|charter school)/i;

async function fetchPlacesRows(loc: NonNullable<Loc>): Promise<any[]> {
  if (!GOOGLE_MAPS_KEY) return [];
  // Two keyword passes — infant centers split between "daycare" and "preschool"
  // categorization on Places. Dedupe by place_id.
  const nearby = async (keyword: string): Promise<any[]> => {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${loc.lat},${loc.lng}`);
    url.searchParams.set('rankby', 'distance');
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('key', GOOGLE_MAPS_KEY);
    const res = await fetch(url.toString());
    const data = await res.json();
    return (data.results ?? []) as any[];
  };
  const [a, b] = await Promise.all([nearby('daycare child care'), nearby('preschool').catch(() => [] as any[])]);
  const seen = new Set<string>();
  return [...a, ...b].filter((r) => {
    if (!r.place_id || seen.has(r.place_id) || SCHOOL_RE.test(String(r.name ?? ''))) return false;
    seen.add(r.place_id);
    return true;
  });
}

async function run(supabase: any, loc: Loc) {
  if (!loc) return { need_location: true };
  // Miami-Dade → DCF registry MERGED with Places (the registry seed misses real
  // centers, e.g. Beehive in Coconut Grove); elsewhere → Places only.
  const inMiami = inMiamiDade(loc.lat, loc.lng);
  const registry: any[] = [];
  if (inMiami) {
    const { data, error } = await supabase.rpc('list_daycares_near', { p_lat: loc.lat, p_lng: loc.lng, p_radius_miles: 10 });
    if (!error) registry.push(...((data ?? []) as any[]).filter((d) => !SCHOOL_RE.test(String(d.name ?? ''))));
  }
  const placesRows = await fetchPlacesRows(loc).catch(() => []);
  if (!registry.length && !placesRows.length) {
    return GOOGLE_MAPS_KEY ? { count: 0, results: [] } : { error: 'daycare_lookup_unavailable' };
  }
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const regNames = registry.map((d) => norm(String(d.name ?? '')));
  const merged = [
    ...registry.map((d) => ({
      name: d.name,
      distance_mi: num(d.distance_mi),
      license_number: d.license_number ?? undefined,
      capacity: d.capacity ?? undefined,
      address: [d.address, d.city].filter(Boolean).join(', '),
    })),
    ...placesRows
      .filter((r) => {
        const pk = norm(String(r.name ?? ''));
        return !regNames.some((rk) => (rk.length >= 6 && pk.includes(rk)) || (pk.length >= 6 && rk.includes(pk)));
      })
      .map((r) => ({
        name: r.name,
        rating: typeof r.rating === 'number' ? num(r.rating) : undefined,
        open_now: r.opening_hours?.open_now,
        distance_mi: r.geometry?.location ? num(haversineMi(loc.lat, loc.lng, r.geometry.location.lat, r.geometry.location.lng)) : undefined,
        address: r.vicinity,
      })),
  ].sort((a, b) => (a.distance_mi ?? 99) - (b.distance_mi ?? 99));
  return {
    count: merged.length,
    results: merged.slice(0, 6),
    note: inMiami
      ? 'mixed sources: rows WITH license_number are from the Miami-Dade DCF registry (tell her to verify CURRENT status on CARES); the rest are public Google listings. villie does not endorse/vet; ages + price coming soon'
      : 'public listings — villie does not endorse/vet; ages, price, licensing coming soon',
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
