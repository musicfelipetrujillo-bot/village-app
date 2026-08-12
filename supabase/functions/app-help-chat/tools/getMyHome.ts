import type { ToolContext, ToolDef } from './types.ts';

// Three small reads that all answer "what is villie showing me right now":
// the curated Home feed, her notification feed, and the Villie Picks shelf.
// Individually they are one query each; as separate tools they would be three
// more schemas on Haiku for no benefit.

async function run(ctx: ToolContext, input: any) {
  const supabase = ctx.supabase;
  const scope = String(input?.scope ?? 'feed');

  if (scope === 'notifications') {
    const unreadOnly = input?.unread_only === true;
    let q = supabase.from('user_notifications_feed')
      .select('type, title, body, is_read, created_at')
      .order('created_at', { ascending: false }).limit(10);
    if (unreadOnly) q = q.eq('is_read', false);
    const { data, error } = await q;
    if (error) return { error: error.message };
    const rows = (data ?? []) as any[];
    return {
      scope, count: rows.length, unread: rows.filter((n) => n.is_read === false).length,
      items: rows.map((n) => ({
        type: n.type, title: n.title,
        body: typeof n.body === 'string' ? n.body.slice(0, 160) : undefined,
        unread: n.is_read === false,
      })),
    };
  }

  if (scope === 'picks') {
    const { data, error } = await supabase.from('villie_picks')
      .select('name, blurb, emoji, category')
      .eq('is_active', true).order('sort_order').limit(8);
    if (error) return { error: error.message };
    const rows = (data ?? []) as any[];
    return {
      scope, count: rows.length,
      // Picks are commerce. Say they're villie's picks, don't oversell them.
      items: rows.map((p) => ({
        name: p.name, category: p.category,
        blurb: typeof p.blurb === 'string' ? p.blurb.slice(0, 160) : undefined,
      })),
    };
  }

  // Home feed — a curated JSONB card array, refreshed daily by home-feed-curator.
  const { data, error } = await supabase.rpc('get_home_feed');
  if (error) return { error: error.message };
  const row = ((data ?? []) as any[])[0];
  const cards = (row?.cards ?? []) as any[];
  return {
    scope: 'feed',
    count: cards.length,
    is_stale: row?.is_stale === true,
    // Cards carry per-type payloads; surface the type + whatever headline each
    // has rather than dumping the whole blob into Haiku's context.
    cards: cards.slice(0, 8).map((c: any) => ({
      type: c?.type ?? c?.kind,
      title: c?.title ?? c?.headline ?? c?.payload?.title,
      copy: typeof (c?.long_copy ?? c?.copy) === 'string' ? String(c.long_copy ?? c.copy).slice(0, 200) : undefined,
    })),
  };
}

export const getMyHome: ToolDef = {
  tier: 'read',
  schema: {
    name: 'get_my_home',
    description:
      "Read what villie is surfacing for her right now. scope: 'feed' (her curated Home cards — the default, " +
      "for \"what's on my home feed\" / \"what should I look at today\"), 'notifications' (her notification " +
      "feed, pass unread_only:true for \"do I have anything new\"), 'picks' (the Villie Picks product shelf, " +
      "for \"what does villie recommend\"). Summarize warmly in a sentence or two — never read a list of " +
      "cards back to her verbatim. Picks are curated product recommendations, so mention them as suggestions, " +
      "never as something she needs to buy.",
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['feed', 'notifications', 'picks'], description: "Which surface. Default 'feed'." },
        unread_only: { type: 'boolean', description: 'notifications only — just the unread ones.' },
      },
    },
  },
  handler: (ctx: ToolContext, input: any) => run(ctx, input),
};
