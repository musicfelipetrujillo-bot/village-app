import type { Loc, ToolContext, ToolDef } from './types.ts';
import { num } from './_util.ts';

async function run(supabase: any, loc: Loc) {
  if (!loc) return { need_location: true };
  const { data, error } = await supabase.rpc('search_donors_near', {
    user_lat: loc.lat, user_lng: loc.lng, radius_miles: 25, filter_badge: null, max_price: null,
  });
  if (error) return { error: error.message };
  const rows = (data ?? []) as any[];
  return {
    count: rows.length,
    results: rows.slice(0, 5).map((d) => ({
      name: d.display_name ?? d.donor_name ?? d.name,
      badge: d.badge_level,
      distance_mi: num(d.distance_miles ?? d.distance_mi ?? d.distance),
      price_per_oz: d.price_per_oz != null ? `$${d.price_per_oz}/oz` : undefined,
    })),
  };
}

export const findDonors: ToolDef = {
  tier: 'read',
  schema: {
    name: 'find_donors',
    description: "Find verified breast-milk donors near the mom (cash / P2P pickup, no in-app payment) and return top matches (name, trust badge, distance). Use when she needs donor milk. Returns need_location:true if location is unavailable.",
    input_schema: { type: 'object', properties: {} },
  },
  handler: (ctx: ToolContext, _input: any) => run(ctx.supabase, ctx.loc),
};
