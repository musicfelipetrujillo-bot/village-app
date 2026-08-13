// V5 Playbook — baby tracker API (migration 093).
//
// Real newborn logging behind the Playbook "Today" tracker: sleep sessions
// (start/stop), feeds (breast L/R timed, or bottle timed + oz), diapers
// (one-tap), and free-form notes. All owner-scoped via RLS — these reads/writes
// only ever touch the signed-in mom's rows. Every call fails SOFT (logs +
// returns null/[]) so the UI degrades gracefully if migration 093 hasn't been
// pushed to this environment yet.
import { supabase } from '@/lib/supabase';
import {
  validateInterval, validateFeedShape, dayKeyLocal, clampOz,
  type LogKind,
} from '@utils/logEntry';

export type FeedMethod = 'breast' | 'bottle';
export type BreastSide = 'left' | 'right';
export type DiaperKind = 'wet' | 'dirty' | 'both';

export interface SleepLog {
  id: string; started_at: string; ended_at: string | null; source: string;
}
export interface FeedLog {
  id: string; method: FeedMethod; side: BreastSide | null;
  started_at: string; ended_at: string | null; amount_oz: number | null; source: string;
}
export interface DiaperLog {
  id: string; kind: DiaperKind; occurred_at: string; source: string;
}
export interface NoteLog {
  id: string; raw_text: string; occurred_at: string;
}

export interface TodayLogs {
  sleep: SleepLog[];
  feeds: FeedLog[];
  diapers: DiaperLog[];
  notes: NoteLog[];
}

// Phase 3 — derived stats over a recent window, used to curate the Playbook
// from the mom's real logs (not illustrative defaults). All optional/null when
// there isn't enough data yet.
export interface RecentStats {
  days: number;
  sleepSessions: number;        // completed naps in window
  avgNapMin: number | null;
  longestNapMin: number | null;
  avgWakeWindowMin: number | null;
  feeds: number;
  feedsPerDay: number | null;
  avgFeedGapMin: number | null;
  diapersPerDay: number | null;
  wetPerDay: number | null;
  dirtyPerDay: number | null;
}

// Phase 2 — result of AI-parsing a free-form jot into structured rows.
export interface ParseResult {
  ok: boolean;
  counts: { sleep: number; feed: number; diaper: number };
  events: unknown[];
}

export type { LogKind };

export type LogEntry =
  | { kind: 'sleep';  row: SleepLog }
  | { kind: 'feed';   row: FeedLog }
  | { kind: 'diaper'; row: DiaperLog }
  | { kind: 'note';   row: NoteLog };

/**
 * Edit and delete report failure, unlike logging.
 *
 * Logging fails soft on purpose so the UI degrades if a migration hasn't
 * landed. Edit and delete must not inherit that: a delete that silently
 * no-ops is worse than no delete button at all.
 */
export interface MutationResult { ok: boolean; reason?: string }

const TABLE: Record<LogKind, string> = {
  sleep: 'baby_sleep_logs',
  feed: 'baby_feed_logs',
  diaper: 'baby_diaper_logs',
  note: 'baby_log_notes',
};

// Postgres unique-violation. Our two partial indexes (uniq_baby_sleep_active,
// uniq_baby_feed_active) permit exactly one open session per user, so an edit
// that reopens a closed session collides with a running one.
const PG_UNIQUE_VIOLATION = '23505';

function mutationError(op: string, error: { message: string; code?: string }): MutationResult {
  console.warn(`[tracker] ${op}`, error.message);
  if (error.code === PG_UNIQUE_VIOLATION) {
    return { ok: false, reason: 'Another session is already running. Stop that one first.' };
  }
  return { ok: false, reason: "That didn't save. Check your connection and try again." };
}

function mean(xs: number[]): number | null { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
function round(n: number | null): number | null { return n == null ? null : Math.round(n); }

let _userId: string | null = null;
async function userId(): Promise<string | null> {
  if (_userId) return _userId;
  const { data } = await supabase.auth.getUser();
  _userId = data.user?.id ?? null;
  return _userId;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const babyTrackerApi = {
  // ── Sleep ───────────────────────────────────────────────────────────────
  async getActiveSleep(): Promise<SleepLog | null> {
    const { data, error } = await supabase
      .from('baby_sleep_logs')
      .select('id, started_at, ended_at, source')
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) { console.warn('[tracker] getActiveSleep', error.message); return null; }
    return (data as SleepLog) ?? null;
  },

  async startSleep(babyProfileId: string, startedAt?: string): Promise<SleepLog | null> {
    const uid = await userId();
    if (!uid) return null;
    const { data, error } = await supabase
      .from('baby_sleep_logs')
      .insert({ user_id: uid, baby_profile_id: babyProfileId, started_at: startedAt ?? new Date().toISOString() })
      .select('id, started_at, ended_at, source')
      .single();
    if (error) { console.warn('[tracker] startSleep', error.message); return null; }
    return data as SleepLog;
  },

  async stopSleep(id: string, endedAt?: string): Promise<boolean> {
    const { error } = await supabase
      .from('baby_sleep_logs')
      .update({ ended_at: endedAt ?? new Date().toISOString() })
      .eq('id', id);
    if (error) { console.warn('[tracker] stopSleep', error.message); return false; }
    return true;
  },

  async updateSleep(
    id: string, patch: { started_at?: string; ended_at?: string | null },
  ): Promise<MutationResult> {
    const current = await supabase
      .from('baby_sleep_logs').select('started_at, ended_at').eq('id', id).maybeSingle();
    if (current.error || !current.data) return { ok: false, reason: "Couldn't find that nap." };
    const started = patch.started_at ?? (current.data.started_at as string);
    const ended = 'ended_at' in patch ? patch.ended_at! : (current.data.ended_at as string | null);
    const v = validateInterval(started, ended, Date.now());
    if (!v.ok) return v;
    const { error } = await supabase.from('baby_sleep_logs').update(patch).eq('id', id);
    return error ? mutationError('updateSleep', error) : { ok: true };
  },

  async updateFeed(
    id: string,
    patch: {
      method?: FeedMethod; side?: BreastSide | null;
      started_at?: string; ended_at?: string | null; amount_oz?: number | null;
    },
  ): Promise<MutationResult> {
    const current = await supabase
      .from('baby_feed_logs')
      .select('method, side, started_at, ended_at, amount_oz').eq('id', id).maybeSingle();
    if (current.error || !current.data) return { ok: false, reason: "Couldn't find that feed." };
    const c = current.data as FeedLog;
    const method = patch.method ?? c.method;
    // `in` rather than `!= null` — this is what lets an edit CLEAR a value.
    const side = 'side' in patch ? patch.side! : c.side;
    const started = patch.started_at ?? c.started_at;
    const ended = 'ended_at' in patch ? patch.ended_at! : c.ended_at;
    const oz = 'amount_oz' in patch
      ? (patch.amount_oz == null ? null : clampOz(patch.amount_oz))
      : c.amount_oz;

    const shape = validateFeedShape(method, method === 'bottle' ? null : side, method === 'breast' ? null : oz);
    if (!shape.ok) return shape;
    const interval = validateInterval(started, ended, Date.now());
    if (!interval.ok) return interval;

    // Normalise so a method switch can never leave an orphan side or oz behind.
    const normalised = {
      ...patch,
      method,
      side: method === 'bottle' ? null : side,
      amount_oz: method === 'breast' ? null : oz,
    };
    const { error } = await supabase.from('baby_feed_logs').update(normalised).eq('id', id);
    return error ? mutationError('updateFeed', error) : { ok: true };
  },

  async updateDiaper(
    id: string, patch: { kind?: DiaperKind; occurred_at?: string },
  ): Promise<MutationResult> {
    if (patch.occurred_at) {
      const v = validateInterval(patch.occurred_at, null, Date.now());
      if (!v.ok) return v;
    }
    const { error } = await supabase.from('baby_diaper_logs').update(patch).eq('id', id);
    return error ? mutationError('updateDiaper', error) : { ok: true };
  },

  async updateNote(
    id: string, patch: { raw_text?: string; occurred_at?: string },
  ): Promise<MutationResult> {
    if (patch.raw_text != null && !patch.raw_text.trim()) {
      return { ok: false, reason: "A note can't be empty. Delete it instead." };
    }
    if (patch.occurred_at) {
      const v = validateInterval(patch.occurred_at, null, Date.now());
      if (!v.ok) return v;
    }
    const { error } = await supabase.from('baby_log_notes').update(patch).eq('id', id);
    return error ? mutationError('updateNote', error) : { ok: true };
  },

  async deleteEntry(kind: LogKind, id: string): Promise<MutationResult> {
    const { error } = await supabase.from(TABLE[kind]).delete().eq('id', id);
    return error ? mutationError('deleteEntry', error) : { ok: true };
  },

  // ── Feeds ─────────────────────────────────────────────────────────────────
  async getActiveFeed(): Promise<FeedLog | null> {
    const { data, error } = await supabase
      .from('baby_feed_logs')
      .select('id, method, side, started_at, ended_at, amount_oz, source')
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) { console.warn('[tracker] getActiveFeed', error.message); return null; }
    return (data as FeedLog) ?? null;
  },

  async startFeed(
    babyProfileId: string, method: FeedMethod, side: BreastSide | null, startedAt?: string,
  ): Promise<FeedLog | null> {
    const uid = await userId();
    if (!uid) return null;
    const { data, error } = await supabase
      .from('baby_feed_logs')
      .insert({
        user_id: uid, baby_profile_id: babyProfileId,
        method, side: method === 'breast' ? side : null,
        started_at: startedAt ?? new Date().toISOString(),
      })
      .select('id, method, side, started_at, ended_at, amount_oz, source')
      .single();
    if (error) { console.warn('[tracker] startFeed', error.message); return null; }
    return data as FeedLog;
  },

  // `amountOz === undefined` leaves ounces untouched; `null` clears them.
  async stopFeed(id: string, endedAt?: string, amountOz?: number | null): Promise<boolean> {
    const patch: Record<string, unknown> = { ended_at: endedAt ?? new Date().toISOString() };
    if (amountOz !== undefined) patch.amount_oz = amountOz == null ? null : clampOz(amountOz);
    const { error } = await supabase.from('baby_feed_logs').update(patch).eq('id', id);
    if (error) { console.warn('[tracker] stopFeed', error.message); return false; }
    return true;
  },

  // Completed bottle in one shot (no live timer) — start == end, carries oz.
  async logBottle(babyProfileId: string, amountOz: number, at?: string): Promise<boolean> {
    const uid = await userId();
    if (!uid) return false;
    const ts = at ?? new Date().toISOString();
    const { error } = await supabase.from('baby_feed_logs').insert({
      user_id: uid, baby_profile_id: babyProfileId,
      method: 'bottle', side: null, started_at: ts, ended_at: ts, amount_oz: amountOz,
    });
    if (error) { console.warn('[tracker] logBottle', error.message); return false; }
    return true;
  },

  // ── Diapers ─────────────────────────────────────────────────────────────
  async logDiaper(babyProfileId: string, kind: DiaperKind, at?: string): Promise<boolean> {
    const uid = await userId();
    if (!uid) return false;
    const { error } = await supabase.from('baby_diaper_logs').insert({
      user_id: uid, baby_profile_id: babyProfileId, kind, occurred_at: at ?? new Date().toISOString(),
    });
    if (error) { console.warn('[tracker] logDiaper', error.message); return false; }
    return true;
  },

  // ── Notes (free-form / dictation) ─────────────────────────────────────────
  async logNote(babyProfileId: string, rawText: string): Promise<boolean> {
    const uid = await userId();
    if (!uid) return false;
    const { error } = await supabase.from('baby_log_notes').insert({
      user_id: uid, baby_profile_id: babyProfileId, raw_text: rawText,
    });
    if (error) { console.warn('[tracker] logNote', error.message); return false; }
    return true;
  },

  // Phase 2 — send the jot to the AI parser, which saves the raw note AND
  // extracts structured sleep/feed/diaper rows. Falls back to a plain raw save
  // when the edge function isn't deployed / reachable (so words are never lost).
  async parseNote(babyProfileId: string, rawText: string): Promise<ParseResult | null> {
    const uid = await userId();
    if (!uid) return null;
    try {
      const { data, error } = await supabase.functions.invoke('playbook-parse-note', {
        body: { raw_text: rawText, baby_profile_id: babyProfileId, now: new Date().toISOString() },
      });
      if (error) throw error;
      const r = data as ParseResult;
      return r?.ok ? r : { ok: true, counts: { sleep: 0, feed: 0, diaper: 0 }, events: [] };
    } catch (e) {
      console.warn('[tracker] parseNote fell back to raw save', String((e as { message?: string })?.message ?? e));
      await babyTrackerApi.logNote(babyProfileId, rawText);
      return null;
    }
  },

  // ── Day / range rollups ────────────────────────────────────────────────────
  // Open sessions older than this stop counting as "today" — a nap nobody
  // stopped three days ago is a data-quality problem for the rescue prompt to
  // handle, not a row that should sit at the top of today's timeline forever.
  async getDay(dayStart: Date = startOfToday()): Promise<TodayLogs> {
    const from = dayStart.toISOString();
    const to = new Date(dayStart.getTime() + 86400000).toISOString();
    const openSince = new Date(Date.now() - 86400000).toISOString();
    const empty: TodayLogs = { sleep: [], feeds: [], diapers: [], notes: [] };

    const openClause = `and(ended_at.is.null,started_at.gte.${openSince})`;
    const [sleep, feeds, diapers, notes] = await Promise.all([
      supabase.from('baby_sleep_logs').select('id, started_at, ended_at, source')
        .or(`and(started_at.gte.${from},started_at.lt.${to}),${openClause}`)
        .order('started_at', { ascending: false }),
      supabase.from('baby_feed_logs').select('id, method, side, started_at, ended_at, amount_oz, source')
        .or(`and(started_at.gte.${from},started_at.lt.${to}),${openClause}`)
        .order('started_at', { ascending: false }),
      supabase.from('baby_diaper_logs').select('id, kind, occurred_at, source')
        .gte('occurred_at', from).lt('occurred_at', to).order('occurred_at', { ascending: false }),
      supabase.from('baby_log_notes').select('id, raw_text, occurred_at')
        .gte('occurred_at', from).lt('occurred_at', to).order('occurred_at', { ascending: false }),
    ]);
    if (sleep.error || feeds.error || diapers.error || notes.error) {
      console.warn('[tracker] getDay', sleep.error?.message || feeds.error?.message || diapers.error?.message || notes.error?.message);
    }
    return {
      sleep: (sleep.data as SleepLog[]) ?? empty.sleep,
      feeds: (feeds.data as FeedLog[]) ?? empty.feeds,
      diapers: (diapers.data as DiaperLog[]) ?? empty.diapers,
      notes: (notes.data as NoteLog[]) ?? empty.notes,
    };
  },

  async getToday(): Promise<TodayLogs> {
    return babyTrackerApi.getDay();
  },

  // History paging — a window of whole days, newest first.
  async getRange(fromISO: string, toISO: string): Promise<TodayLogs> {
    const empty: TodayLogs = { sleep: [], feeds: [], diapers: [], notes: [] };
    const [sleep, feeds, diapers, notes] = await Promise.all([
      supabase.from('baby_sleep_logs').select('id, started_at, ended_at, source')
        .gte('started_at', fromISO).lt('started_at', toISO).order('started_at', { ascending: false }),
      supabase.from('baby_feed_logs').select('id, method, side, started_at, ended_at, amount_oz, source')
        .gte('started_at', fromISO).lt('started_at', toISO).order('started_at', { ascending: false }),
      supabase.from('baby_diaper_logs').select('id, kind, occurred_at, source')
        .gte('occurred_at', fromISO).lt('occurred_at', toISO).order('occurred_at', { ascending: false }),
      supabase.from('baby_log_notes').select('id, raw_text, occurred_at')
        .gte('occurred_at', fromISO).lt('occurred_at', toISO).order('occurred_at', { ascending: false }),
    ]);
    if (sleep.error || feeds.error || diapers.error || notes.error) {
      console.warn('[tracker] getRange', sleep.error?.message || feeds.error?.message);
    }
    return {
      sleep: (sleep.data as SleepLog[]) ?? empty.sleep,
      feeds: (feeds.data as FeedLog[]) ?? empty.feeds,
      diapers: (diapers.data as DiaperLog[]) ?? empty.diapers,
      notes: (notes.data as NoteLog[]) ?? empty.notes,
    };
  },

  // Every open session regardless of age — the rescue prompt's input.
  async getOpenSessions(): Promise<{ sleep: SleepLog | null; feed: FeedLog | null }> {
    const [s, f] = await Promise.all([
      babyTrackerApi.getActiveSleep(),
      babyTrackerApi.getActiveFeed(),
    ]);
    return { sleep: s, feed: f };
  },

  // ── Recent stats (Phase 3 curation) ───────────────────────────────────────
  // Aggregates the last `days` of logs into gentle patterns: average wake
  // window, feed cadence, and diaper counts per day. Fails soft → null.
  // weekOffset shifts the window back by whole weeks: 0 = the last `days`,
  // 1 = the 7 days before that, etc. — so Insights can show past weeks.
  async getRecentStats(days = 3, weekOffset = 0): Promise<RecentStats | null> {
    const end = Date.now() - weekOffset * 7 * 86400000;
    const endISO = new Date(end).toISOString();
    const since = new Date(end - days * 86400000).toISOString();
    const [sleepR, feedR, diaperR] = await Promise.all([
      supabase.from('baby_sleep_logs').select('started_at, ended_at')
        .gte('started_at', since).lt('started_at', endISO).order('started_at', { ascending: true }),
      supabase.from('baby_feed_logs').select('started_at')
        .gte('started_at', since).lt('started_at', endISO).order('started_at', { ascending: true }),
      supabase.from('baby_diaper_logs').select('kind, occurred_at')
        .gte('occurred_at', since).lt('occurred_at', endISO),
    ]);
    if (sleepR.error && feedR.error && diaperR.error) {
      console.warn('[tracker] getRecentStats', sleepR.error?.message);
      return null;
    }

    const sleeps = ((sleepR.data as { started_at: string; ended_at: string | null }[]) ?? [])
      .filter((s) => s.ended_at);
    const napMins = sleeps.map((s) => (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 60000)
      .filter((m) => m >= 3 && m <= 600);
    // Wake windows: awake gap between the end of one nap and the start of the next.
    const wakeWindows: number[] = [];
    for (let i = 1; i < sleeps.length; i++) {
      const gap = (new Date(sleeps[i].started_at).getTime() - new Date(sleeps[i - 1].ended_at!).getTime()) / 60000;
      if (gap >= 5 && gap <= 300) wakeWindows.push(gap);
    }

    const feeds = ((feedR.data as { started_at: string }[]) ?? []);
    const feedGaps: number[] = [];
    for (let i = 1; i < feeds.length; i++) {
      const gap = (new Date(feeds[i].started_at).getTime() - new Date(feeds[i - 1].started_at).getTime()) / 60000;
      if (gap >= 20 && gap <= 420) feedGaps.push(gap);
    }
    const feedDays = new Set(feeds.map((f) => dayKeyLocal(f.started_at))).size || 1;

    const diapers = ((diaperR.data as { kind: DiaperKind; occurred_at: string }[]) ?? []);
    const diaperDays = new Set(diapers.map((d) => dayKeyLocal(d.occurred_at))).size || 1;
    const wet = diapers.filter((d) => d.kind === 'wet' || d.kind === 'both').length;
    const dirty = diapers.filter((d) => d.kind === 'dirty' || d.kind === 'both').length;

    return {
      days,
      sleepSessions: napMins.length,
      avgNapMin: round(mean(napMins)),
      longestNapMin: napMins.length ? Math.round(Math.max(...napMins)) : null,
      avgWakeWindowMin: round(mean(wakeWindows)),
      feeds: feeds.length,
      feedsPerDay: feeds.length ? Math.round((feeds.length / feedDays) * 10) / 10 : null,
      avgFeedGapMin: round(mean(feedGaps)),
      diapersPerDay: diapers.length ? Math.round((diapers.length / diaperDays) * 10) / 10 : null,
      wetPerDay: wet ? Math.round((wet / diaperDays) * 10) / 10 : null,
      dirtyPerDay: dirty ? Math.round((dirty / diaperDays) * 10) / 10 : null,
    };
  },
};
