import type { Loc, ToolContext, ToolDef } from './types.ts';
import { num } from './_util.ts';

async function run(supabase: any, loc: Loc, specialty?: string) {
  if (!loc) return { need_location: true };
  const { data, error } = await supabase.rpc('specialists_near', {
    lat: loc.lat, lng: loc.lng, radius_miles: 25,
    specialty_filter: specialty || null, language_filter: null, insurance_filter: null, telehealth_only: false,
  });
  if (error) return { error: error.message };
  const rows = (data ?? []) as any[];
  return {
    count: rows.length,
    results: rows.slice(0, 5).map((s) => ({
      id: s.id,
      name: s.full_name ?? s.name ?? s.display_name,
      specialty: s.specialty,
      distance_mi: num(s.distance_miles ?? s.distance_mi ?? s.distance),
      rating: num(s.rating_avg ?? s.rating),
      city: s.city,
      telehealth: s.telehealth ?? s.telehealth_available,
    })),
  };
}

export const findSpecialists: ToolDef = {
  tier: 'read',
  schema: {
    name: 'find_specialists',
    description: "Find real maternal-health specialists near the mom and return the top matches (name, specialty, distance, rating). Use when she asks to find/see a provider. If a specialty is given it MUST be one of: OB/GYN, Doula, Midwife, Lactation Consultant, Pediatrician, Sleep Coach, Pelvic Floor PT, Perinatal Dietitian, PPD Therapist. Returns need_location:true if her location isn't available (then ask her to enable location or share her ZIP).",
    input_schema: {
      type: 'object',
      properties: { specialty: { type: 'string', description: 'One of the allowed specialties, or omit for all.' } },
    },
  },
  handler: (ctx: ToolContext, input: any) => run(ctx.supabase, ctx.loc, input?.specialty),
};
