// V5 Playbook — baby tracker API (migration 093).
//
// Real newborn logging behind the Playbook "Today" tracker: sleep sessions
// (start/stop), feeds (breast L/R timed, or bottle timed + oz), diapers
// (one-tap), and free-form notes. All owner-scoped via RLS — these reads/writes
// only ever touch the signed-in mom's rows. Every call fails SOFT (logs +
// returns null/[]) so the UI degrades gracefully if migration 093 hasn't been
// pushed to this environment yet.
import { supabase } from '@/lib/supabase';

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

let _userId: string | null = null;
async function userId(): Promise<string | null> {
  if (_userId) return _userId;
  const { data } = await supabase.auth.getUser();
  _userId = data.user?.id ?? null;
  return _userId;
}

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
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

  async stopFeed(id: string, endedAt?: string, amountOz?: number | null): Promise<boolean> {
    const patch: Record<string, unknown> = { ended_at: endedAt ?? new Date().toISOString() };
    if (amountOz != null) patch.amount_oz = amountOz;
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

  // ── Notes (free-form / dictation; AI parse in Phase 2) ────────────────────
  async logNote(babyProfileId: string, rawText: string): Promise<boolean> {
    const uid = await userId();
    if (!uid) return false;
    const { error } = await supabase.from('baby_log_notes').insert({
      user_id: uid, baby_profile_id: babyProfileId, raw_text: rawText,
    });
    if (error) { console.warn('[tracker] logNote', error.message); return false; }
    return true;
  },

  // ── Today's rollup ────────────────────────────────────────────────────────
  async getToday(): Promise<TodayLogs> {
    const since = startOfTodayISO();
    const empty: TodayLogs = { sleep: [], feeds: [], diapers: [], notes: [] };
    const [sleep, feeds, diapers, notes] = await Promise.all([
      // include in-progress sessions even if started before midnight
      supabase.from('baby_sleep_logs').select('id, started_at, ended_at, source')
        .or(`started_at.gte.${since},ended_at.is.null`).order('started_at', { ascending: false }),
      supabase.from('baby_feed_logs').select('id, method, side, started_at, ended_at, amount_oz, source')
        .or(`started_at.gte.${since},ended_at.is.null`).order('started_at', { ascending: false }),
      supabase.from('baby_diaper_logs').select('id, kind, occurred_at, source')
        .gte('occurred_at', since).order('occurred_at', { ascending: false }),
      supabase.from('baby_log_notes').select('id, raw_text, occurred_at')
        .gte('occurred_at', since).order('occurred_at', { ascending: false }),
    ]);
    if (sleep.error || feeds.error || diapers.error || notes.error) {
      console.warn('[tracker] getToday', sleep.error?.message || feeds.error?.message || diapers.error?.message || notes.error?.message);
    }
    return {
      sleep: (sleep.data as SleepLog[]) ?? empty.sleep,
      feeds: (feeds.data as FeedLog[]) ?? empty.feeds,
      diapers: (diapers.data as DiaperLog[]) ?? empty.diapers,
      notes: (notes.data as NoteLog[]) ?? empty.notes,
    };
  },
};
