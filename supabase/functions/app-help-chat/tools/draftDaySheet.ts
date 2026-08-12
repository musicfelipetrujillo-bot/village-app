import type { ToolContext, ToolDef } from './types.ts';
import { resolveUserId } from './_util.ts';

// Server-side mirror of the mobile Day Sheet auto-draft (apps/mobile/src/api/
// daySheets.ts `draftScheduleFromLogs` + `deriveKeyTimes`): read her last 7 days
// of feed/nap logs (RLS-scoped), cluster start times to a typical day, and insert
// a PRIVATE draft into `day_sheets` (is_shared defaults false; sharing stays a
// native-UI action in DaySheetShare). One server-only wrinkle: mobile buckets log
// times in DEVICE-local time — here we resolve her timezone from
// users.notif_prefs.quiet_hours.tz (migration 033 backfill, default America/New_York).

type SheetRowKind = 'wake' | 'bottle' | 'nap' | 'meal' | 'bath' | 'bed' | 'note';
interface SheetRow { time: string; kind: SheetRowKind; text: string }

const DEFAULT_TZ = 'America/New_York';

function minutesToLabel(min: number): string {
  let h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ap = h < 12 ? 'a' : 'p';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')}${ap}`;
}

function localMinutesInTz(iso: string, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: 'numeric', minute: 'numeric' })
      .formatToParts(new Date(iso));
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return h * 60 + m;
  } catch {
    const d = new Date(iso);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

function todayInTz(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch { return new Date().toISOString().slice(0, 10); }
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Greedy 1-D cluster of minute values → representative (median) times (mobile parity).
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

// Gentle fallback when she hasn't logged enough yet (mobile TEMPLATE parity).
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

function deriveKeyTimes(schedule: SheetRow[]) {
  return {
    naps: schedule.filter((r) => r.kind === 'nap').map((r) => r.time),
    bed: schedule.find((r) => r.kind === 'bed')?.time ?? '',
    bottles: schedule.filter((r) => r.kind === 'bottle').map((r) => r.time),
    meals: schedule.filter((r) => r.kind === 'meal').map((r) => r.time),
  };
}

async function draftSchedule(ctx: ToolContext, tz: string): Promise<{ schedule: SheetRow[]; from_logs: boolean }> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [feedsR, sleepsR] = await Promise.all([
    ctx.supabase.from('baby_feed_logs').select('started_at').gte('started_at', since),
    ctx.supabase.from('baby_sleep_logs').select('started_at').gte('started_at', since),
  ]);
  const feedMins = ((feedsR.data ?? []) as any[]).map((r) => localMinutesInTz(r.started_at, tz));
  const sleepMins = ((sleepsR.data ?? []) as any[]).map((r) => localMinutesInTz(r.started_at, tz));
  if (feedMins.length < 4 && sleepMins.length < 3) return { schedule: TEMPLATE, from_logs: false };

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

  return { schedule: rows.sort((a, b) => a.min - b.min).map((r) => r.row), from_logs: true };
}

async function resolveBaby(ctx: ToolContext): Promise<{ user_id: string; baby_profile_id: string; baby_name: string | null } | null> {
  const user_id = await resolveUserId(ctx);
  if (!user_id) return null;
  // Prefer the per-request pre-fetched profile (index.ts); fall back to a query.
  if (ctx.baby?.id) return { user_id, baby_profile_id: ctx.baby.id, baby_name: ctx.baby.name ?? null };
  const { data } = await ctx.supabase
    .from('baby_profiles').select('id, baby_name').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (!data?.id) return null;
  return { user_id, baby_profile_id: data.id, baby_name: (data as any).baby_name ?? null };
}

async function run(ctx: ToolContext, input: any) {
  const ids = await resolveBaby(ctx);
  if (!ids) return { error: 'no_baby_profile', message: "She hasn't set up a baby profile yet. Offer to take her there and call navigate with screen 'baby_profile_setup' — do NOT tell her to find a button on Home herself." };

  // Her timezone, from quiet-hours prefs (fail-soft to the default).
  let tz = DEFAULT_TZ;
  try {
    const { data: u } = await ctx.supabase.from('users').select('notif_prefs').eq('id', ids.user_id).maybeSingle();
    const prefTz = (u as any)?.notif_prefs?.quiet_hours?.tz;
    if (typeof prefTz === 'string' && prefTz) tz = prefTz;
  } catch { /* keep default */ }

  const rawDate = typeof input?.date === 'string' ? input.date.trim() : '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : addDays(todayInTz(tz), 1);
  const notes = typeof input?.notes === 'string' ? input.notes.trim().slice(0, 500) : '';

  const { schedule, from_logs } = await draftSchedule(ctx, tz);

  // Same insert shape as the mobile builder's create payload (daySheetsApi.create).
  // share_token + is_shared:false come from column defaults → the draft stays PRIVATE.
  const { data, error } = await ctx.supabase.from('day_sheets').insert({
    user_id: ids.user_id,
    baby_profile_id: ids.baby_profile_id,
    baby_name: ids.baby_name,
    starts_on: date,
    schedule,
    key_times: deriveKeyTimes(schedule),
    essentials: {},
    tips: notes ? [{ text: notes, photo_url: null }] : [],
  }).select('id').single();
  if (error) return { error: error.message };
  return { ok: true, day_sheet_id: data?.id ?? null, date, items: schedule.length, from_logs };
}

export const draftDaySheet: ToolDef = {
  tier: 'do',
  schema: {
    name: 'draft_day_sheet',
    description:
      'Draft a shareable caregiver day sheet (nanny/grandparent handoff) for a given day, auto-built from her ' +
      "logged feeds and naps. Use when she asks for a day sheet / handoff sheet / 'sheet for the sitter'. " +
      "It creates a PRIVATE draft — after ok, tell her it's ready to review, edit, and share, and add cta " +
      '{"label":"Review day sheet","screen":"day_sheet"}.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'The day the sheet covers, YYYY-MM-DD. Default: tomorrow.' },
        notes: { type: 'string', description: 'Optional short care note from her (e.g. "he\'s teething") — added to the sheet as a tip.' },
      },
    },
  },
  handler: (ctx, input) => run(ctx, input),
};
