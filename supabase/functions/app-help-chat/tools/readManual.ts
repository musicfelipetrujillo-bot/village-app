import type { ToolContext, ToolDef } from './types.ts';

// The Manual library, five ways, behind one schema. Splitting these into five
// tools would have put Billy near 30 schemas on Haiku for no gain — a mom asks
// "what's in the Manual this week" and "show me the videos" in the same breath.
//
// ⚠️ PRO GATING IS ENFORCED INSIDE THE RPCs. list_manual_videos and
// get_manual_week_intro null out mux_playback_id and set is_locked=true for
// non-Pro callers (migration 110). Billy inherits that automatically because he
// uses the user-scoped JWT client like every other tool — he CANNOT leak a paid
// video. His only job is honest copy: when is_locked, say it's in villie pro.
// The written Manual (pieces) is free forever and is never gated.

const MOM_CATS = ['feel', 'heal', 'nourish', 'rest', 'tips'];
const BABY_CATS = ['feed', 'sleep', 'grow', 'care', 'tips'];

async function run(ctx: ToolContext, input: any) {
  const supabase = ctx.supabase;
  const locale = ctx.locale ?? 'en';
  const scope = String(input?.scope ?? 'this_week');
  const audience = input?.audience === 'mom' ? 'mom' : 'baby';
  const askedWeek = Number(input?.week);
  const week = Number.isFinite(askedWeek) ? Math.max(0, Math.min(52, Math.round(askedWeek))) : (ctx.baby?.week ?? 1);

  const rawCat = String(input?.category ?? '');
  const valid = audience === 'mom' ? MOM_CATS : BABY_CATS;
  const category = valid.includes(rawCat) ? rawCat : null;

  if (scope === 'this_week') {
    const { data, error } = await supabase.rpc('list_this_week_manual', { p_week: week, p_locale: locale });
    if (error) return { error: error.message };
    const rows = (data ?? []) as any[];
    return {
      scope, week, count: rows.length,
      items: rows.slice(0, 8).map((r) => ({
        title: r.title, audience: r.audience, category: r.category,
        minutes: r.duration_seconds ? Math.round(r.duration_seconds / 60) : undefined,
        watched: r.is_watched === true,
      })),
    };
  }

  if (scope === 'week_intro') {
    const { data, error } = await supabase.rpc('get_manual_week_intro', { p_audience: audience, p_week: week, p_locale: locale });
    if (error) return { error: error.message };
    const v = ((data ?? []) as any[])[0];
    if (!v) return { scope, week, audience, found: false };
    return {
      scope, week, audience, found: true,
      title: v.title, expert: v.expert_name, expert_role: v.expert_role,
      minutes: v.duration_seconds ? Math.round(v.duration_seconds / 60) : undefined,
      is_locked: v.is_locked === true,
    };
  }

  if (scope === 'videos') {
    const { data, error } = await supabase.rpc('list_manual_videos', { p_audience: audience, p_category: category, p_locale: locale });
    if (error) return { error: error.message };
    const rows = (data ?? []) as any[];
    return {
      scope, audience, category: category ?? 'all', count: rows.length,
      any_locked: rows.some((r) => r.is_locked === true),
      items: rows.slice(0, 8).map((r) => ({
        title: r.title,
        minutes: r.duration_seconds ? Math.round(r.duration_seconds / 60) : undefined,
        watched: r.is_watched === true, saved: r.is_saved === true, is_locked: r.is_locked === true,
      })),
    };
  }

  if (scope === 'pieces') {
    const { data, error } = await supabase.rpc('list_manual_pieces', { p_audience: audience, p_category: category, p_locale: locale });
    if (error) return { error: error.message };
    const rows = (data ?? []) as any[];
    return {
      scope, audience, category: category ?? 'all', count: rows.length,
      note: 'Written Manual pieces are FREE for everyone — never gate these.',
      items: rows.slice(0, 8).map((r) => ({
        kind: r.kind, title: r.title,
        excerpt: typeof r.excerpt === 'string' ? r.excerpt.slice(0, 200) : undefined,
      })),
    };
  }

  if (scope === 'saved') {
    const { data, error } = await supabase.rpc('list_my_saved_manual', { p_locale: locale });
    if (error) return { error: error.message };
    const rows = (data ?? []) as any[];
    return {
      scope, count: rows.length,
      items: rows.slice(0, 10).map((r) => ({
        title: r.title, audience: r.audience, category: r.category,
        minutes: r.duration_seconds ? Math.round(r.duration_seconds / 60) : undefined,
        watched: r.is_watched === true,
      })),
    };
  }

  return { error: 'unknown_scope' };
}

export const readManual: ToolDef = {
  tier: 'read',
  schema: {
    name: 'read_manual',
    description:
      "Read the Manual — villie's content library. scope: 'this_week' (what's curated for her week — the " +
      "default and the right answer for \"what's in the Manual this week\"), 'videos' (the video library), " +
      "'pieces' (written stories / checklists / infographics), 'week_intro' (this week's single intro video " +
      "+ the expert who filmed it), 'saved' (videos SHE has saved). `audience` splits mom-facing from " +
      "baby-facing content ('baby' default); `category` optionally narrows it — mom: feel/heal/nourish/rest/tips, " +
      "baby: feed/sleep/grow/care/tips. `week` defaults to her baby's current week.\n" +
      "PAID CONTENT: when an item has is_locked:true it is a villie pro video and she cannot watch it yet — " +
      "say so plainly and warmly ('that one's part of villie pro'), never describe its contents as if she can " +
      "play it, and never imply the written Manual is locked (text is free forever). If any_locked is true, " +
      "mention pro ONCE at the end, not per item.",
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['this_week', 'videos', 'pieces', 'week_intro', 'saved'], description: "Which slice. Default 'this_week'." },
        audience: { type: 'string', enum: ['mom', 'baby'], description: "Whose content. Default 'baby'." },
        category: { type: 'string', description: 'Optional. mom: feel|heal|nourish|rest|tips · baby: feed|sleep|grow|care|tips' },
        week: { type: 'integer', description: 'Week 0-52. Defaults to her current week.' },
      },
    },
  },
  handler: (ctx: ToolContext, input: any) => run(ctx, input),
};
