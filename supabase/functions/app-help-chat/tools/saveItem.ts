import type { ToolContext, ToolDef } from './types.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// item_type → { table, fk column } — verified against the mobile write paths:
// specialists.ts toggleFavorite → favorites(user_id, specialist_id) UNIQUE(user_id, specialist_id)
// milk.ts saveDonor → milk_saved_donors(user_id, donor_profile_id) PK(user_id, donor_profile_id)
// gear.ts saveListing → gear_saved_listings(user_id, listing_id) PK(user_id, listing_id) + bump_gear_save_count trigger
const TARGETS: Record<string, { table: string; column: string }> = {
  specialist: { table: 'favorites', column: 'specialist_id' },
  donor: { table: 'milk_saved_donors', column: 'donor_profile_id' },
  gear: { table: 'gear_saved_listings', column: 'listing_id' },
};

async function run(ctx: ToolContext, input: any) {
  const item_type = String(input?.item_type ?? '');
  const target = TARGETS[item_type];
  if (!target) return { error: 'unknown_item_type' };

  const item_id = String(input?.item_id ?? '').trim();
  if (!UUID_RE.test(item_id)) {
    // NOTE: `message` is coaching for you, not copy for her. She must never hear
    // the words "id", "uuid", or "exact item ID" — asking her to go fetch one
    // shipped twice (2026-08-02) and reads as Billy refusing a save he could do.
    //
    // You genuinely do NOT have ids from earlier turns: the chat history that
    // comes back to you is plain {role, content} text, so the tool_result rows
    // holding the ids are dropped at the end of every request. That is why
    // "re-read your last result" is not an option — there is nothing to re-read.
    return {
      error: 'need_item_id',
      message: 'You have no ids this turn (tool results are not carried between turns). Do NOT ask her for one. Call the matching search tool again RIGHT NOW — find_donors for a donor, search_gear for gear, find_specialists for a specialist — then call save_item with the id at the position she named. Same query as before, so the order matches what she saw.',
    };
  }

  const { data: auth } = await ctx.supabase.auth.getUser();
  const user_id = auth?.user?.id;
  if (!user_id) return { error: 'not_signed_in' };

  if (input?.unsave === true) {
    const { error } = await ctx.supabase
      .from(target.table).delete()
      .eq('user_id', user_id).eq(target.column, item_id);
    return error ? { error: error.message } : { ok: true, saved: false, item_type };
  }

  const { error } = await ctx.supabase
    .from(target.table).insert({ user_id, [target.column]: item_id });
  if (error) {
    // 23505 unique violation = already on her list — same tolerance as the mobile code.
    if (error.code === '23505') return { ok: true, already_saved: true, item_type };
    // 23503 FK violation = the id doesn't exist (stale or hallucinated).
    if (error.code === '23503') {
      return { error: 'not_found', message: 'That id does not match any current result — re-run the search and use an id from it.' };
    }
    return { error: error.message };
  }
  return { ok: true, saved: true, item_type };
}

export const saveItem: ToolDef = {
  tier: 'do',
  schema: {
    name: 'save_item',
    description:
      'Save (or unsave with unsave:true) something she found — a specialist, milk donor, or gear listing — ' +
      'to her saved list. IMPORTANT: ids do not survive between turns — the history you receive is ' +
      'plain text, so the search results you listed a moment ago are gone from your context. When she ' +
      'refers back to one ("save it", "save the first one", "save the UPPAbaby"), silently RE-RUN the ' +
      'matching search tool first (find_donors / search_gear / find_specialists, same query as before ' +
      'so the order matches), then call save_item with the id at the position she named. Never ask her ' +
      'for an id, never ask her to go tap the listing herself, and never say the words id or ID to her ' +
      '— she has no idea what that means and it reads as you refusing. Resolving her reference: ' +
      '"save it" / "save that one" after a single result = that result; ordinals = that position in ' +
      'the order you listed; a brand or name = the matching row. If the re-run genuinely returns ' +
      'fewer results than she referenced, say so plainly and offer what you did find. After ok, ' +
      'confirm warmly with the item name.',
    input_schema: {
      type: 'object',
      properties: {
        item_type: { type: 'string', enum: ['specialist', 'donor', 'gear'], description: 'What kind of item she is saving.' },
        item_id: { type: 'string', description: 'The uuid id of the item, taken from a prior search result.' },
        unsave: { type: 'boolean', description: 'true to remove it from her saved list instead.' },
      },
      required: ['item_type', 'item_id'],
    },
  },
  handler: (ctx, input) => run(ctx, input),
};
