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

// ⚠️ list_manual_videos and list_manual_pieces filter with `category = p_category`.
// SQL equality against NULL is never true, so passing a null category returns ZERO
// rows — not "all categories". Billy therefore told the founder "the video library
// doesn't have content yet" while 22 approved videos sat in the table (2026-08-12).
// When she doesn't name a category we fan out across all of them and merge.
// These lists are the DB's actual categories, not the client's ManualCategory union
// — that union is missing 'soothe', which has 2 approved baby videos behind it.
const MOM_CATS = ['feel', 'heal', 'nourish', 'rest', 'tips'];
const BABY_CATS = ['feed', 'sleep', 'grow', 'care', 'soothe', 'tips'];

async function listAcrossCategories(
  supabase: any, fn: 'list_manual_videos' | 'list_manual_pieces',
  audience: string, category: string | null, locale: string,
): Promise<{ rows: any[]; error?: string; partial?: number }> {
  const cats = category ? [category] : (audience === 'mom' ? MOM_CATS : BABY_CATS);
  const results = await Promise.all(
    cats.map((c) => supabase.rpc(fn, { p_audience: audience, p_category: c, p_locale: locale })),
  );
  const failed = results.filter((r: any) => r.error);
  // All failed = a real error (e.g. anon calling an authenticated-only RPC).
  if (failed.length === cats.length) return { rows: [], error: failed[0].error.message };
  return {
    rows: results.flatMap((r: any) => (r.data ?? []) as any[]),
    // Some failed = a partial list. Never let that read as the complete library.
    partial: failed.length > 0 ? failed.length : undefined,
  };
}

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
    // No intro filmed for this week yet. The LIBRARY still has videos, so don't
    // leave her with a flat "nothing" — say the week's intro isn't up and point
    // at what is. (Weeks past the produced range hit this constantly.)
    if (!v) return {
      scope, week, audience, found: false,
      next_best: "No intro video for this week yet. Say so briefly, then offer the video library (read_manual scope 'videos') or this week's curated set — do not imply the Manual is empty.",
    };
    return {
      scope, week, audience, found: true,
      title: v.title, expert: v.expert_name, expert_role: v.expert_role,
      minutes: v.duration_seconds ? Math.round(v.duration_seconds / 60) : undefined,
      is_locked: v.is_locked === true,
    };
  }

  if (scope === 'videos') {
    const { rows, error, partial } = await listAcrossCategories(supabase, 'list_manual_videos', audience, category, locale);
    if (error) return { error };
    return {
      scope, audience, category: category ?? 'all', count: rows.length,
      partial_categories_failed: partial,
      any_locked: rows.some((r) => r.is_locked === true),
      items: rows.slice(0, 8).map((r) => ({
        title: r.title,
        minutes: r.duration_seconds ? Math.round(r.duration_seconds / 60) : undefined,
        watched: r.is_watched === true, saved: r.is_saved === true, is_locked: r.is_locked === true,
      })),
    };
  }

  if (scope === 'pieces') {
    const { rows, error, partial } = await listAcrossCategories(supabase, 'list_manual_pieces', audience, category, locale);
    if (error) return { error };
    return {
      scope, audience, category: category ?? 'all', count: rows.length,
      partial_categories_failed: partial,
      note: 'Written Manual pieces are FREE for everyone — never gate these.',
      // The week's story/checklist content ships INSIDE the app (manualWeekContent.ts),
      // not in this table, so an empty result does NOT mean she has nothing to read.
      // Saying "there's nothing" would be wrong — send her to the Manual instead.
      empty_means: rows.length === 0
        ? "The database has no extra written pieces, but her Manual DOES have this week's written story and checklist built into the app. Do NOT tell her there is nothing to read — tell her this week's written Manual is waiting in the app and offer the manual cta."
        : undefined,
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
      "baby: feed/sleep/grow/care/soothe/tips. `week` defaults to her baby's current week.\n" +
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
