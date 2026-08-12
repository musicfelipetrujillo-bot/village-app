import type { ToolContext, ToolDef } from './types.ts';
import { DEFAULT_TZ, localClock, localDayRange, minsBetween } from './_util.ts';

// Companion to get_baby_tracking_stats: that one answers "what are his PATTERNS
// over the last week", this one answers "what has happened TODAY, and is a timer
// running right now". Both are RLS-scoped to her own rows via the JWT client.
//
// An open row (ended_at IS NULL) is a RUNNING timer, and it can have started
// before midnight — a nap begun at 11:40pm is still running at 12:10am — so the
// open-timer lookup is deliberately NOT bounded by the day window.

async function run(ctx: ToolContext) {
  const supabase = ctx.supabase;
  const tz = ctx.tz || DEFAULT_TZ;
  const { startIso, endIso, date } = localDayRange(tz);

  const [sleepR, feedR, diaperR, openSleepR, openFeedR] = await Promise.all([
    supabase.from('baby_sleep_logs').select('started_at, ended_at')
      .gte('started_at', startIso).lt('started_at', endIso).order('started_at'),
    supabase.from('baby_feed_logs').select('started_at, ended_at, method, amount_oz')
      .gte('started_at', startIso).lt('started_at', endIso).order('started_at'),
    supabase.from('baby_diaper_logs').select('kind, occurred_at')
      .gte('occurred_at', startIso).lt('occurred_at', endIso).order('occurred_at'),
    supabase.from('baby_sleep_logs').select('started_at').is('ended_at', null)
      .order('started_at', { ascending: false }).limit(1),
    supabase.from('baby_feed_logs').select('started_at').is('ended_at', null)
      .order('started_at', { ascending: false }).limit(1),
  ]);

  const err = sleepR.error || feedR.error || diaperR.error;
  if (err) return { error: err.message };

  const sleeps = (sleepR.data ?? []) as any[];
  const feeds = (feedR.data ?? []) as any[];
  const diapers = (diaperR.data ?? []) as any[];

  const finishedNaps = sleeps.filter((s) => s.ended_at);
  const napMins = finishedNaps.map((s) => minsBetween(s.started_at, s.ended_at));
  const totalNapMin = napMins.reduce((a, b) => a + b, 0);

  const oz = feeds.reduce((a, f) => a + (typeof f.amount_oz === 'number' ? f.amount_oz : 0), 0);
  const bottles = feeds.filter((f) => f.method === 'bottle').length;
  const nursing = feeds.filter((f) => f.method === 'breast').length;

  const countKind = (k: string) => diapers.filter((d) => d.kind === k).length;

  // A running timer is the single most actionable thing here — surface it first.
  const openSleep = (openSleepR.data ?? [])[0] as any;
  const openFeed = (openFeedR.data ?? [])[0] as any;
  const open = openSleep ?? openFeed;
  const nowIso = new Date().toISOString();
  const active_timer = open
    ? {
        kind: openSleep ? 'nap' : 'feed',
        started_at: localClock(open.started_at, tz),
        running_min: minsBetween(open.started_at, nowIso),
      }
    : null;

  const has_data = sleeps.length > 0 || feeds.length > 0 || diapers.length > 0 || !!active_timer;

  return {
    date, timezone: tz, has_data, active_timer,
    feeds: {
      count: feeds.length,
      total_oz: oz > 0 ? Math.round(oz * 10) / 10 : undefined,
      bottles: bottles || undefined,
      nursing_sessions: nursing || undefined,
      last_at: localClock(feeds[feeds.length - 1]?.started_at, tz),
    },
    naps: {
      count: finishedNaps.length,
      total_min: totalNapMin || undefined,
      longest_min: napMins.length ? Math.max(...napMins) : undefined,
      last_ended: localClock(finishedNaps[finishedNaps.length - 1]?.ended_at, tz),
    },
    diapers: {
      count: diapers.length,
      wet: countKind('wet') || undefined,
      dirty: countKind('dirty') || undefined,
      both: countKind('both') || undefined,
      last_at: localClock(diapers[diapers.length - 1]?.occurred_at, tz),
    },
  };
}

export const getMyDay: ToolDef = {
  tier: 'read',
  schema: {
    name: 'get_my_day',
    description:
      "Read what the mom has logged for her baby SO FAR TODAY — feeds (count, total oz, last time), " +
      "naps (count, total minutes, when the last one ended), diapers (count by wet/dirty/both), and " +
      "whether a nap or feed TIMER IS RUNNING right now. Use for 'what have I logged today?', " +
      "'when did he last eat?', 'is his nap timer still going?', 'how many diapers today?'. " +
      "Call it immediately — never ask whether she has a baby profile or has logged anything, the " +
      "tool tells you (has_data:false means nothing logged yet today; invite her to start and offer " +
      "the Playbook cta). If active_timer is present, LEAD with it and say how long it has been running. " +
      "For patterns across days ('is his sleep on track', 'average wake window') use " +
      "get_baby_tracking_stats instead — this tool is only today.",
    input_schema: { type: 'object', properties: {} },
  },
  handler: (ctx: ToolContext) => run(ctx),
};
