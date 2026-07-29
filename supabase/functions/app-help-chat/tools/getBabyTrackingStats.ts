import type { ToolContext, ToolDef } from './types.ts';

// Server-side mirror of the mobile getRecentStats aggregation (RLS-scoped via the
// caller's JWT client, so it only ever reads HER rows).
async function getTrackerStats(supabase: any, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [sleepR, feedR, diaperR] = await Promise.all([
    supabase.from('baby_sleep_logs').select('started_at, ended_at').gte('started_at', since).order('started_at', { ascending: true }),
    supabase.from('baby_feed_logs').select('started_at').gte('started_at', since).order('started_at', { ascending: true }),
    supabase.from('baby_diaper_logs').select('kind, occurred_at').gte('occurred_at', since),
  ]);
  const sleeps = ((sleepR.data ?? []) as any[]).filter((s) => s.ended_at);
  const naps = sleeps
    .map((s) => (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)
    .filter((m) => m >= 3 && m <= 600);
  const wake: number[] = [];
  for (let i = 1; i < sleeps.length; i++) {
    const g = (new Date(sleeps[i].started_at).getTime() - new Date(sleeps[i - 1].ended_at).getTime()) / 60000;
    if (g >= 5 && g <= 300) wake.push(g);
  }
  const feeds = (feedR.data ?? []) as any[];
  const gaps: number[] = [];
  for (let i = 1; i < feeds.length; i++) {
    const g = (new Date(feeds[i].started_at).getTime() - new Date(feeds[i - 1].started_at).getTime()) / 60000;
    if (g >= 20 && g <= 420) gaps.push(g);
  }
  const feedDays = new Set(feeds.map((f) => String(f.started_at).slice(0, 10))).size || 1;
  const diapers = (diaperR.data ?? []) as any[];
  const diaperDays = new Set(diapers.map((d) => String(d.occurred_at).slice(0, 10))).size || 1;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  return {
    has_data: naps.length > 0 || feeds.length > 0 || diapers.length > 0,
    window_days: days,
    naps_logged: naps.length,
    avg_nap_min: avg(naps),
    longest_nap_min: naps.length ? Math.round(Math.max(...naps)) : null,
    avg_wake_window_min: avg(wake),
    feeds_logged: feeds.length,
    feeds_per_day: feeds.length ? Math.round((feeds.length / feedDays) * 10) / 10 : null,
    avg_feed_gap_min: avg(gaps),
    diapers_per_day: diapers.length ? Math.round((diapers.length / diaperDays) * 10) / 10 : null,
  };
}

export const getBabyTrackingStats: ToolDef = {
  tier: 'read',
  schema: {
    name: 'get_baby_tracking_stats',
    description: "Read the mom's own recently logged baby data (naps, feeds, diapers) from the Playbook tracker and return aggregate patterns: average wake window, feed gap, nap length (all minutes) and diapers per day. Returns has_data:false when she hasn't logged enough yet.",
    input_schema: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Look-back window in days (default 7).' } },
    },
  },
  handler: (ctx: ToolContext, input: any) => getTrackerStats(ctx.supabase, Number(input?.days) || 7),
};
