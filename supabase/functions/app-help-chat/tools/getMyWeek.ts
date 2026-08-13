import type { ToolContext, ToolDef } from './types.ts';

// "What's going on this week" — three capabilities that answer the same question
// from different angles, so they share one tool rather than three schemas:
//   · her CURRENT milestone           → get_my_current_milestone()
//   · any week's milestones           → get_milestones_for_week(p_week)
//   · the weekly journey + checklist  → get_weekly_journey(p_week, p_locale)
//
// week omitted = her baby's current week (from ctx.baby, populated per request).

async function run(ctx: ToolContext, input: any) {
  const supabase = ctx.supabase;
  const locale = ctx.locale ?? 'en';
  const asked = Number(input?.week);
  const week = Number.isFinite(asked) ? Math.max(0, Math.min(52, Math.round(asked))) : (ctx.baby?.week ?? null);
  const isCurrent = !Number.isFinite(asked);

  // No week to work from and she asked about "this week" → she has no baby
  // profile yet. Say so and route, rather than guessing week 1.
  if (week == null) {
    return { needs_baby_profile: true, message: 'No baby profile yet, so there is no current week. Offer the baby_profile_setup route.' };
  }

  const [milestoneR, journeyR] = await Promise.all([
    isCurrent
      ? supabase.rpc('get_my_current_milestone')
      : supabase.rpc('get_milestones_for_week', { p_week: week }),
    supabase.rpc('get_weekly_journey', { p_week: week, p_locale: locale }),
  ]);

  const mRows = (milestoneR.data ?? []) as any[];
  const milestones = mRows.slice(0, 4).map((m) => ({
    category: m.category,
    title: m.title,
    description: typeof m.description === 'string' ? m.description.slice(0, 280) : undefined,
  }));

  const j = (journeyR.data ?? {}) as any;
  const insights = ((j.maternal_insights ?? []) as any[]).slice(0, 3).map((i) => ({
    category: i.category,
    title: i.title,
    body: typeof i.body === 'string' ? i.body.slice(0, 280) : undefined,
  }));
  const checklist = ((j.checklists ?? []) as any[]).slice(0, 8).map((c) => ({
    item: c.item_text, essential: c.is_essential === true, done: c.completed === true,
  }));

  return {
    week,
    is_current_week: isCurrent,
    baby_name: mRows[0]?.baby_name ?? ctx.baby?.name ?? undefined,
    has_content: milestones.length > 0 || insights.length > 0 || checklist.length > 0,
    milestones,
    // The journey is about HER recovery, not the baby's development — keep the
    // two separate in the reply so it doesn't read as one blurred list.
    for_you: insights,
    checklist,
    checklist_done: checklist.filter((c) => c.done).length,
  };
}

export const getMyWeek: ToolDef = {
  tier: 'read',
  schema: {
    name: 'get_my_week',
    description:
      "Read what this week holds — the baby's developmental milestones AND the mom's own weekly journey " +
      "(recovery insights + her checklist, with which items she has already ticked off). Omit `week` for " +
      "her baby's current week; pass a number (0-52) for 'what should I expect at week 12?'. Use for " +
      "'what milestone is he at?', 'what's happening this week', 'what should I expect at week N', " +
      "'what's on my checklist'. Milestones are about the BABY and for_you is about HER recovery — keep " +
      "them distinct when you answer, don't blur them into one list. Frame milestones as ranges, never as " +
      "a schedule she is behind on. Returns needs_baby_profile:true when she has no baby set up yet.",
    input_schema: {
      type: 'object',
      properties: {
        week: { type: 'integer', description: 'Week 0-52. Omit for her current week.' },
      },
    },
  },
  handler: (ctx: ToolContext, input: any) => run(ctx, input),
};
