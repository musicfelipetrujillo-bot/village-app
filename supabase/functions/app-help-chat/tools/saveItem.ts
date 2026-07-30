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
    return { error: 'need_item_id', message: 'Ask her which one — you need its id from a prior search result.' };
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
      "to her saved list. Only call with a real item id from a prior tool result; if you don't have one, " +
      'ask which result she means. After ok, confirm warmly.',
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
