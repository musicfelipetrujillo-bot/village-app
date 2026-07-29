import type { ToolContext, ToolDef } from './types.ts';

async function resolveBaby(ctx: ToolContext): Promise<{ user_id: string; baby_profile_id: string } | null> {
  const { data: auth } = await ctx.supabase.auth.getUser();
  const user_id = auth?.user?.id;
  if (!user_id) return null;
  // Prefer the per-request pre-fetched profile (index.ts); fall back to a query.
  if (ctx.baby?.id) return { user_id, baby_profile_id: ctx.baby.id };
  const { data } = await ctx.supabase
    .from('baby_profiles').select('id').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (!data?.id) return null;
  return { user_id, baby_profile_id: data.id };
}

async function run(ctx: ToolContext, input: any) {
  const kind = String(input?.kind ?? '');
  const ids = await resolveBaby(ctx);
  if (!ids) return { error: 'no_baby_profile', message: "She hasn't set up a baby profile yet. Offer to take her there and call navigate with screen 'baby_profile_setup' — do NOT tell her to find a button on Home herself." };
  const now = new Date();
  const at = input?.minutes_ago ? new Date(now.getTime() - Number(input.minutes_ago) * 60000) : now;

  if (kind === 'nap') {
    const dur = Number(input?.duration_min) || 0;
    const started = dur > 0 ? new Date(at.getTime() - dur * 60000) : at;
    const { error } = await ctx.supabase.from('baby_sleep_logs').insert({
      user_id: ids.user_id, baby_profile_id: ids.baby_profile_id,
      started_at: started.toISOString(), ended_at: dur > 0 ? at.toISOString() : null, source: 'note',
    });
    return error ? { error: error.message } : { ok: true, logged: 'nap', duration_min: dur || null };
  }
  if (kind === 'feed') {
    const method = input?.method === 'breast' ? 'breast' : 'bottle';
    const { error } = await ctx.supabase.from('baby_feed_logs').insert({
      user_id: ids.user_id, baby_profile_id: ids.baby_profile_id, method,
      side: method === 'breast' ? (input?.side ?? null) : null,
      started_at: at.toISOString(), ended_at: at.toISOString(),
      amount_oz: input?.amount_oz != null ? Number(input.amount_oz) : null, source: 'note',
    });
    return error ? { error: error.message } : { ok: true, logged: 'feed', method };
  }
  if (kind === 'diaper') {
    const dk = ['wet', 'dirty', 'both'].includes(input?.diaper_kind) ? input.diaper_kind : 'wet';
    const { error } = await ctx.supabase.from('baby_diaper_logs').insert({
      user_id: ids.user_id, baby_profile_id: ids.baby_profile_id, kind: dk,
      occurred_at: at.toISOString(), source: 'note',
    });
    return error ? { error: error.message } : { ok: true, logged: 'diaper', diaper_kind: dk };
  }
  return { error: 'unknown_kind' };
}

export const logBabyEvent: ToolDef = {
  tier: 'do',
  schema: {
    name: 'log_baby_event',
    description:
      "Log ONE baby event to the mom's Playbook tracker for HER baby: a nap, a feed, or a diaper. " +
      "Use when she says she just did one, e.g. 'log a 30 min nap', 'he took 4 oz', 'wet diaper'. " +
      "Call it IMMEDIATELY once you know kind (+ amount/duration if she gave one) — do NOT ask follow-up " +
      "questions first. Never ask what was in a bottle: contents aren't recorded (only method + oz), and her " +
      "feeding_method is already in your context. " +
      "This WRITES to her data — only call it when she's clearly asking to record something, not when she's " +
      "asking a question. After it returns ok, confirm warmly what you logged and add cta " +
      '{"label":"Open Playbook","screen":"playbook"}. If it returns no_baby_profile, ' +
      "call the navigate tool with screen 'baby_profile_setup' to take her straight to the baby-card setup, " +
      "and say you're taking her there.",
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['nap', 'feed', 'diaper'], description: 'What happened.' },
        duration_min: { type: 'integer', description: 'nap only — length in minutes if she gave one.' },
        minutes_ago: { type: 'integer', description: 'How long ago it ended/happened (default now).' },
        method: { type: 'string', enum: ['breast', 'bottle'], description: 'feed only.' },
        side: { type: 'string', enum: ['left', 'right'], description: 'feed+breast only.' },
        amount_oz: { type: 'number', description: 'feed+bottle only — ounces.' },
        diaper_kind: { type: 'string', enum: ['wet', 'dirty', 'both'], description: 'diaper only.' },
      },
      required: ['kind'],
    },
  },
  handler: (ctx, input) => run(ctx, input),
};
