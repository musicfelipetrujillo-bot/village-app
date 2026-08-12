import type { ToolContext, ToolDef } from './types.ts';

// One RPC covers FIVE capability rows — get_saved_dashboard returns every saved
// section at once (Manual videos, specialists, milk donors, gear), which is
// exactly what "show me everything I've saved" wants, and also the cheapest way
// to answer "which donors have I saved". Returns scalar JSONB, so supabase-js
// surfaces it as `data` directly rather than a row array.

async function run(ctx: ToolContext, input: any) {
  const { data, error } = await ctx.supabase.rpc('get_saved_dashboard', { p_locale: ctx.locale ?? 'en' });
  if (error) return { error: error.message };
  const d = (data ?? {}) as any;

  const only = String(input?.section ?? 'all');
  const price = (g: any) => (g?.is_free ? 'free' : (typeof g?.price_cents === 'number' ? `$${Math.round(g.price_cents / 100)}` : undefined));

  const sections: Record<string, unknown> = {
    videos: {
      count: d.videos_count ?? 0,
      items: ((d.videos ?? []) as any[]).slice(0, 6).map((v) => ({ title: v.title, category: v.category })),
    },
    specialists: {
      count: d.specialists_count ?? 0,
      items: ((d.specialists ?? []) as any[]).slice(0, 6).map((s) => ({
        name: s.full_name ?? s.display_name ?? s.name, type: s.specialist_type ?? s.type, city: s.city,
      })),
    },
    donors: {
      count: d.donors_count ?? 0,
      items: ((d.donors ?? []) as any[]).slice(0, 6).map((x) => ({
        name: x.display_name, city: x.city, state: x.state,
      })),
    },
    gear: {
      count: d.gear_count ?? 0,
      items: ((d.gear ?? []) as any[]).slice(0, 6).map((g) => ({
        title: g.title, price: price(g), condition: g.condition,
        // A saved listing can go sold/withdrawn under her — say so rather than
        // sending her to a dead listing.
        unavailable: g.status && g.status !== 'active' ? g.status : undefined,
      })),
    },
  };

  if (only !== 'all' && sections[only]) {
    return { section: only, ...(sections[only] as Record<string, unknown>) };
  }
  return { total: d.total ?? 0, ...sections };
}

export const getSaved: ToolDef = {
  tier: 'read',
  schema: {
    name: 'get_saved',
    description:
      "Read what the mom has SAVED across the whole app — Manual videos, specialists (favorites), milk donors, " +
      "and gear listings, with counts. Use for 'show me everything I've saved', 'which specialists have I " +
      "favorited', 'what gear did I save', 'which donors have I saved'. Pass `section` to narrow to one; omit " +
      "for the full picture. If a saved gear item comes back with `unavailable`, tell her it's no longer " +
      "available instead of pointing her at it. To SAVE something new use save_item, not this tool.",
    input_schema: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: ['all', 'videos', 'specialists', 'donors', 'gear'], description: "Narrow to one section. Default 'all'." },
      },
    },
  },
  handler: (ctx: ToolContext, input: any) => run(ctx, input),
};
