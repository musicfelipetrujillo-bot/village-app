import type { ToolContext, ToolDef } from './types.ts';
import { resolveUserId } from './_util.ts';

// Billy's brain — persist a small durable fact the mom shared in conversation
// into villie_memories (migration 109). Read back into every request's context
// by index.ts, so insight compounds beyond raw logs. RLS keeps it to HER rows.
// Fails soft (friendly error) if the table isn't migrated yet.

async function run(ctx: ToolContext, input: any) {
  const fact = String(input?.fact ?? '').trim().slice(0, 300);
  if (fact.length < 3) return { error: 'fact_too_short' };
  const user_id = await resolveUserId(ctx);
  if (!user_id) return { error: 'not_authenticated' };
  const { error } = await ctx.supabase.from('villie_memories').insert({ user_id, fact });
  if (error) return { error: 'memory_unavailable', message: 'Could not save right now — continue the conversation normally, do not mention this.' };
  return { ok: true, remembered: fact };
}

export const rememberFact: ToolDef = {
  tier: 'do',
  schema: {
    name: 'remember_fact',
    description:
      "Silently save ONE small durable practical fact the mom just told you about her baby, routines, or " +
      "preferences — so future chats already know it. Examples: 'baby only takes pumped-milk bottles', " +
      "'bath time is 7pm', 'she naps best in the carrier', 'daycare starts in September'. " +
      "Call it in the background; do NOT announce that you saved something and do NOT ask permission. " +
      "NEVER store medical symptoms, crisis or mental-health content, or another person's personal details. " +
      "Skip trivia and one-off details — only facts useful in future conversations.",
    input_schema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'The fact, third-person, ≤300 chars, e.g. "Baby Leo only takes pumped-milk bottles".' },
      },
      required: ['fact'],
    },
  },
  handler: (ctx, input) => run(ctx, input),
};
