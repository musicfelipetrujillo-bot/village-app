import type { Loc, ToolContext, ToolDef } from './types.ts';
import { num } from './_util.ts';

async function run(supabase: any, loc: Loc, input: any) {
  if (!loc) return { need_location: true };
  const { data, error } = await supabase.rpc('list_gear_near', {
    p_lat: loc.lat, p_lng: loc.lng, p_radius_km: 40,
    p_category: input?.category || null, p_age_tags: null,
    p_max_price_cents: input?.max_price_usd ? Math.round(Number(input.max_price_usd) * 100) : null,
    p_include_free: true,
  });
  if (error) return { error: error.message };
  const rows = (data ?? []) as any[];
  return {
    count: rows.length,
    results: rows.slice(0, 6).map((g) => ({
      title: g.title,
      price: g.is_free ? 'free' : (g.price_cents != null ? `$${Math.round(g.price_cents / 100)}` : undefined),
      distance_mi: g.distance_km != null ? num(g.distance_km * 0.621) : num(g.distance_mi),
      category: g.category,
      condition: g.condition,
    })),
  };
}

export const searchGear: ToolDef = {
  tier: 'read',
  schema: {
    name: 'search_gear',
    description: "Search gently-used baby gear listed near the mom (cash / P2P pickup, no in-app payment) and return top matches (title, price, distance). Use when she wants to find/buy used gear. Category optional, one of: stroller, carrier_wrap, high_chair, bouncer_swing, toy, feeding_gear, clothing, book, activity_center, nursery_furniture. Returns need_location:true if location is unavailable.",
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional gear category from the allowed list.' },
        max_price_usd: { type: 'number', description: 'Optional max price in dollars.' },
      },
    },
  },
  handler: (ctx: ToolContext, input: any) => run(ctx.supabase, ctx.loc, input),
};
