import type { ToolContext, ToolDef } from './types.ts';
import { resolveUserId } from './_util.ts';

// Mirrors the mobile Milk Vault write path (apps/mobile/src/api/milkVault.ts
// addBag + MilkVaultAddBagScreen): plain RLS insert into milk_vault_bags with
// status 'stored' and frozen_at defaulting to pumped_at. This is her PRIVATE
// freezer stash — never touches the public milk_vault_listings table.
// Statuses that count as "in the freezer" — same set the dashboard hero sums
// (apps/mobile/src/utils/milkVaultCalc.ts IN_FREEZER_STATUSES).
const IN_FREEZER_STATUSES = ['stored', 'reserved', 'available'];

async function run(ctx: ToolContext, input: any) {
  const user_id = await resolveUserId(ctx);
  if (!user_id) return { error: 'not_signed_in' };

  // Ounces: mobile rounds to 1 decimal; DB CHECK is 0 < ounces <= 100.
  const ounces = Math.round(Number(input?.ounces) * 10) / 10;
  if (!Number.isFinite(ounces) || ounces <= 0 || ounces > 100) {
    return { error: 'invalid_ounces', message: 'A single bag must be between 0 and 100 ounces.' };
  }

  // Pumped time: ISO date or datetime; defaults to now. +24h tolerance so a
  // date-only string (parsed as UTC midnight) never false-rejects across tz.
  const now = new Date();
  let pumped = now;
  if (input?.pumped_at != null && String(input.pumped_at).trim() !== '') {
    const parsed = new Date(String(input.pumped_at));
    if (Number.isNaN(parsed.getTime())) return { error: 'invalid_pumped_at' };
    if (parsed.getTime() > now.getTime() + 24 * 3600 * 1000) return { error: 'pumped_at_in_future' };
    pumped = parsed;
  }
  const pumped_at = pumped.toISOString();

  const note = typeof input?.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 500) : null;

  const { error } = await ctx.supabase.from('milk_vault_bags').insert({
    user_id,
    baby_profile_id: null, // mobile add-bag screen doesn't attach a baby either
    ounces,
    pumped_at,
    frozen_at: pumped_at, // spec default: blank frozen date falls back to pumped
    notes: note,
    status: 'stored',
  });
  if (error) return { error: error.message };

  // Running freezer total — same math as the dashboard ring (sum of ounces
  // across in-freezer bags). Best-effort: the insert already succeeded.
  let total_oz: number | null = null;
  const { data: bags, error: sumErr } = await ctx.supabase
    .from('milk_vault_bags')
    .select('ounces')
    .eq('user_id', user_id)
    .in('status', IN_FREEZER_STATUSES);
  if (!sumErr && Array.isArray(bags)) {
    total_oz = Math.round(bags.reduce((sum, b) => sum + (Number(b.ounces) || 0), 0) * 10) / 10;
  }

  return { ok: true, ounces_added: ounces, ...(total_oz != null ? { total_oz } : {}) };
}

export const logMilkStash: ToolDef = {
  tier: 'do',
  schema: {
    name: 'log_milk_stash',
    description:
      "Add a pumped-milk bag to HER private freezer stash (Milk Vault). Use when she says she pumped " +
      "or froze milk, e.g. 'add 5 oz to my stash', 'I pumped 4 oz'. This is her personal tracker, NOT " +
      "a public listing. Call it IMMEDIATELY once you know the ounces — no follow-up questions. After " +
      "ok, confirm warmly (mention the new freezer total from total_oz if returned, e.g. \"that's X oz " +
      'in the freezer now") and add cta {"label":"Open Milk Vault","screen":"milk_vault"}.',
    input_schema: {
      type: 'object',
      properties: {
        ounces: { type: 'number', description: 'Bag size in ounces (0–100; one decimal is fine).' },
        pumped_at: {
          type: 'string',
          description: "When she pumped it — ISO date or datetime, e.g. '2026-07-29'. Omit for now.",
        },
        note: { type: 'string', description: "Optional short note for the bag, e.g. 'morning pump'." },
      },
      required: ['ounces'],
    },
  },
  handler: (ctx, input) => run(ctx, input),
};
