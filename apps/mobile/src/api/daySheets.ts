// daySheets.ts — "Day Sheet" caregiver handoff API.
//
// A day sheet is a shareable routine sheet (schedule + pro tips w/ photos +
// essentials) built for a nanny / grandparent. The schedule is auto-DRAFTED
// from the mom's logged feeds/naps (last 7 days, clustered to typical times)
// and then edited before sharing. Handoff = PDF (client) + a live web page
// reached by QR (edge fn `day-sheet-page`). Every call fails soft.
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────
export type SheetRowKind = 'wake' | 'bottle' | 'nap' | 'meal' | 'bath' | 'bed' | 'note';

export interface SheetRow { time: string; kind: SheetRowKind; text: string }
export interface SheetTip { text: string; photo_url: string | null }
export interface SheetEssentials {
  emergency?: string; allergies?: string; pediatrician?: string; comfort?: string; meds?: string;
}
export interface KeyTimes { naps: string[]; bed: string; bottles: string[]; meals: string[] }

export interface DaySheet {
  id: string;
  user_id: string;
  baby_profile_id: string | null;
  baby_name: string | null;
  title: string | null;
  for_whom: string | null;
  starts_on: string | null;
  ends_on: string | null;
  schedule: SheetRow[];
  key_times: KeyTimes;
  essentials: SheetEssentials;
  tips: SheetTip[];
  share_token: string;
  is_shared: boolean;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DaySheetInput = Partial<Omit<DaySheet, 'id' | 'user_id' | 'share_token' | 'created_at' | 'updated_at'>>;

// Row visual metadata. The two things a caregiver most needs — FEEDS (rose) and
// NAPS (honey) — get a soft row tint + bold ink so they pop; everything else
// (wake/bath/bed) is muted grey so it recedes. `rowBg:''` = not highlighted.
export interface RowMeta { emoji: string; label: string; chip: string; rowBg: string; timeColor: string; textColor: string }
export const ROW_META: Record<SheetRowKind, RowMeta> = {
  wake:   { emoji: '☀️', label: 'Wake',   chip: '#EDEAF6', rowBg: '',        timeColor: '#A99C7E', textColor: '#9A8264' },
  bottle: { emoji: '🍼', label: 'Bottle', chip: '#FBD9E1', rowBg: '#FDEFF2', timeColor: '#B0234F', textColor: '#3D2116' },
  nap:    { emoji: '💤', label: 'Nap',    chip: '#F6E2AE', rowBg: '#FCF3DC', timeColor: '#B98A1E', textColor: '#3D2116' },
  meal:   { emoji: '🍽️', label: 'Meal',   chip: '#FBD9E1', rowBg: '#FDEFF2', timeColor: '#B0234F', textColor: '#3D2116' },
  bath:   { emoji: '🛁', label: 'Bath',   chip: '#E7EDEF', rowBg: '',        timeColor: '#A99C7E', textColor: '#9A8264' },
  bed:    { emoji: '🌙', label: 'Bed',    chip: '#EDEAF6', rowBg: '',        timeColor: '#A99C7E', textColor: '#9A8264' },
  note:   { emoji: '📝', label: 'Note',   chip: '#F1E7D3', rowBg: '',        timeColor: '#A99C7E', textColor: '#9A8264' },
};

// ── Time helpers ───────────────────────────────────────────────────────────
export function minutesToLabel(min: number): string {
  let h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ap = h < 12 ? 'a' : 'p';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')}${ap}`;
}
function localMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
// Greedy 1-D cluster of minute values → representative (median) times.
function cluster(mins: number[], gap = 55, minSupport = 2): number[] {
  const xs = [...mins].sort((a, b) => a - b);
  const out: number[] = [];
  let group: number[] = [];
  const flush = () => {
    if (group.length >= minSupport) out.push(group[Math.floor(group.length / 2)]);
    group = [];
  };
  for (const x of xs) {
    if (group.length && x - group[group.length - 1] > gap) flush();
    group.push(x);
  }
  flush();
  return out;
}

// ── Auto-draft the schedule from the last N days of real logs ────────────────
const TEMPLATE: SheetRow[] = [
  { time: '6:30a', kind: 'wake', text: 'Wakes up' },
  { time: '7:00a', kind: 'bottle', text: 'Bottle' },
  { time: '9:00a', kind: 'nap', text: 'Nap · 1–1.5 hrs' },
  { time: '11:30a', kind: 'meal', text: 'Lunch · water + paci' },
  { time: '2:00p', kind: 'nap', text: 'Nap · 1–1.5 hrs' },
  { time: '5:00p', kind: 'meal', text: 'Dinner' },
  { time: '6:30p', kind: 'bath', text: 'Bath + bottle · wind down' },
  { time: '7:00p', kind: 'bed', text: 'Bed' },
];

export function deriveKeyTimes(schedule: SheetRow[]): KeyTimes {
  return {
    naps: schedule.filter((r) => r.kind === 'nap').map((r) => r.time),
    bed: schedule.find((r) => r.kind === 'bed')?.time ?? '',
    bottles: schedule.filter((r) => r.kind === 'bottle').map((r) => r.time),
    meals: schedule.filter((r) => r.kind === 'meal').map((r) => r.time),
  };
}

// Returns a draft schedule (real times where we have enough logs, else a gentle
// template) — the mom always edits before sharing.
export async function draftScheduleFromLogs(days = 7): Promise<{ schedule: SheetRow[]; fromLogs: boolean }> {
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [feedsR, sleepsR] = await Promise.all([
      supabase.from('baby_feed_logs').select('started_at').gte('started_at', since),
      supabase.from('baby_sleep_logs').select('started_at').gte('started_at', since),
    ]);
    const feedMins = (feedsR.data ?? []).map((r: any) => localMinutes(r.started_at));
    const sleepMins = (sleepsR.data ?? []).map((r: any) => localMinutes(r.started_at));
    if (feedMins.length < 4 && sleepMins.length < 3) return { schedule: TEMPLATE, fromLogs: false };

    const feedTimes = cluster(feedMins);
    const napStarts = cluster(sleepMins);
    // Evening sleep (after ~6pm) becomes "bed"; earlier ones are naps.
    const naps = napStarts.filter((m) => m < 18 * 60);
    const bedMin = napStarts.find((m) => m >= 18 * 60);

    const rows: { min: number; row: SheetRow }[] = [];
    const wake = Math.min(...(feedMins.length ? feedMins : [390]), ...(sleepMins.length ? sleepMins : [390]));
    rows.push({ min: wake - 10, row: { time: minutesToLabel(Math.max(0, wake - 10)), kind: 'wake', text: 'Wakes up' } });
    feedTimes.forEach((m) => rows.push({ min: m, row: { time: minutesToLabel(m), kind: 'bottle', text: 'Bottle' } }));
    naps.forEach((m) => rows.push({ min: m, row: { time: minutesToLabel(m), kind: 'nap', text: 'Nap · 1–1.5 hrs' } }));
    rows.push({ min: bedMin ?? 19 * 60, row: { time: minutesToLabel(bedMin ?? 19 * 60), kind: 'bed', text: 'Bed' } });

    const schedule = rows.sort((a, b) => a.min - b.min).map((r) => r.row);
    return { schedule, fromLogs: true };
  } catch (e) {
    console.warn('[daySheets] draft', e);
    return { schedule: TEMPLATE, fromLogs: false };
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────
export const daySheetsApi = {
  async listMine(): Promise<DaySheet[]> {
    const { data, error } = await supabase.from('day_sheets').select('*').order('updated_at', { ascending: false });
    if (error) { console.warn('[daySheets] list', error.message); return []; }
    return (data ?? []) as DaySheet[];
  },

  async get(id: string): Promise<DaySheet | null> {
    const { data, error } = await supabase.from('day_sheets').select('*').eq('id', id).maybeSingle();
    if (error) { console.warn('[daySheets] get', error.message); return null; }
    return (data as DaySheet) ?? null;
  },

  async create(input: DaySheetInput): Promise<DaySheet | null> {
    const { data, error } = await supabase.from('day_sheets').insert(input).select('*').single();
    if (error) { console.warn('[daySheets] create', error.message); return null; }
    return data as DaySheet;
  },

  async update(id: string, patch: DaySheetInput): Promise<boolean> {
    const { error } = await supabase.from('day_sheets').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { console.warn('[daySheets] update', error.message); return false; }
    return true;
  },

  async remove(id: string): Promise<boolean> {
    const { error } = await supabase.from('day_sheets').delete().eq('id', id);
    if (error) { console.warn('[daySheets] remove', error.message); return false; }
    return true;
  },

  // Upload a "snap a pic" tip photo → public URL.
  async uploadTipPhoto(uri: string): Promise<string | null> {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return null;
      const ext = (uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
      const key = `${uid}/${Date.now()}.${ext}`;
      const res = await fetch(uri);
      const buf = await res.arrayBuffer();
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const { error } = await supabase.storage.from('day-sheet-photos').upload(key, buf, { contentType, upsert: false });
      if (error) { console.warn('[daySheets] upload', error.message); return null; }
      return supabase.storage.from('day-sheet-photos').getPublicUrl(key).data.publicUrl;
    } catch (e) { console.warn('[daySheets] upload', e); return null; }
  },
};

// Public live-page URL the QR encodes.
export function shareUrl(token: string): string {
  const base = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  return `${base}/functions/v1/day-sheet-page?t=${token}`;
}
