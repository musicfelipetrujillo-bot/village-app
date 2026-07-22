import type { Loc, ToolContext, ToolDef } from './types.ts';
import { num } from './_util.ts';

async function run(supabase: any, loc: Loc, input: any) {
  if (!loc) return { need_location: true };
  const { data, error } = await supabase.rpc('list_events_near', {
    p_lat: loc.lat, p_lng: loc.lng, p_radius_km: 40, p_type: input?.type || null, p_age_tags: null,
  });
  if (error) return { error: error.message };
  const rows = (data ?? []) as any[];
  return {
    count: rows.length,
    results: rows.slice(0, 6).map((e) => ({
      title: e.title,
      when: e.starts_at ?? e.start_at ?? e.start_time ?? e.when,
      type: e.event_type ?? e.type,
      distance_mi: e.distance_km != null ? num(e.distance_km * 0.621) : num(e.distance_mi ?? e.distance),
      city: e.city ?? e.location_name ?? e.venue,
      virtual: e.is_virtual ?? e.virtual ?? (e.event_type === 'webinar'),
    })),
  };
}

export const findEvents: ToolDef = {
  tier: 'read',
  schema: {
    name: 'find_events',
    description: "Find real maternal / parenting events + classes near the mom (e.g. postpartum yoga, support groups, mom meetups, webinars) and return top matches (title, when, distance, type). Use when she wants to find a class / event / meetup — ESPECIALLY when she says it should 'fit my schedule': then cross-check the results against her calendar BUSY windows in the context and recommend one that falls in a FREE slot, saying why it fits. Returns need_location:true if location is unavailable.",
    input_schema: {
      type: 'object',
      properties: { type: { type: 'string', description: "Optional filter: 'local' (in-person) or 'webinar'." } },
    },
  },
  handler: (ctx: ToolContext, input: any) => run(ctx.supabase, ctx.loc, input),
};
