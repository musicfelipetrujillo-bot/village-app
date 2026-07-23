// dayPlan.ts — the deterministic day planner. Weaves baby's nap/feed windows
// (age-based wake-window model) and the mom's chosen pump cadence around her
// real calendar busy blocks, and flags nap↔meeting collisions with a nudge.
// Everything the mom picks is editable; villie only SUGGESTS.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BusyBlock } from './calendar';
import type { DayOverrides } from './dayPlanOverrides';

export type PumpCadence = 'every_3h' | 'twice_shift' | 'morning_evening' | 'none';

export const PUMP_CADENCE_OPTIONS: { key: PumpCadence; label: string }[] = [
  { key: 'every_3h', label: 'every 3 hours' },
  { key: 'twice_shift', label: 'twice during my work shift' },
  { key: 'morning_evening', label: 'morning + evening only' },
  { key: 'none', label: "i'm not pumping" },
];

const RHYTHM_KEY = 'village.dayPlan.rhythm.v1';

export async function getPumpCadence(): Promise<PumpCadence | null> {
  try {
    const v = await AsyncStorage.getItem(RHYTHM_KEY);
    return v && ['every_3h', 'twice_shift', 'morning_evening', 'none'].includes(v) ? (v as PumpCadence) : null;
  } catch {
    return null;
  }
}

export async function setPumpCadence(c: PumpCadence): Promise<void> {
  try { await AsyncStorage.setItem(RHYTHM_KEY, c); } catch { /* non-fatal */ }
}

export type SlotKind = 'calendar' | 'nap' | 'feed' | 'pump';
export type PlanSlot = {
  id: string;
  kind: SlotKind;
  title: string;
  start: Date;
  end: Date;
  note?: string;
  source: 'calendar' | 'villie';
};
export type Nudge = { id: string; text: string };
// `allDay` = long/multi-day blocks (conferences, travel days) shown as a context
// banner, NOT woven into the timeline or treated as a nap/pump collision.
export type DayPlan = { slots: PlanSlot[]; nudges: Nudge[]; allDay: { id: string; title: string }[] };

// Age-based wake windows (minutes awake / nap length), from the same model the
// Manual's wake-window infographic uses.
function windowsForWeek(week: number): { awake: number; nap: number } {
  if (week <= 4) return { awake: 60, nap: 45 };
  if (week <= 12) return { awake: 75, nap: 50 };
  if (week <= 16) return { awake: 90, nap: 60 };
  if (week <= 24) return { awake: 120, nap: 75 };
  return { awake: 150, nap: 90 };
}

const at = (base: Date, h: number, m: number) => {
  const d = new Date(base); d.setHours(h, m, 0, 0); return d;
};
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);
const overlaps = (aS: Date, aE: Date, bS: Date, bE: Date) => aS < bE && bS < aE;

// Compact 12-hour time, no meridiem — matches the timeline mock ("1:30").
export function fmtTime(d: Date): string {
  let h = d.getHours(); const m = d.getMinutes();
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')}`;
}
export function meridiem(d: Date): string {
  return d.getHours() < 12 ? 'am' : 'pm';
}

export function buildDayPlan(opts: {
  busy: BusyBlock[];
  weekNumber: number;
  cadence: PumpCadence;
  babyName: string;
  now?: Date;
  // The baby's REAL logged rhythm (avg wake window + nap length) from the
  // Playbook. When present it overrides the age-based defaults per-field.
  rhythm?: { wakeMin?: number | null; napMin?: number | null };
  // Per-block edits the mom made to villie's suggested slots (shift / dismiss).
  overrides?: DayOverrides;
}): DayPlan {
  const { busy, weekNumber, cadence, babyName } = opts;
  const now = opts.now ?? new Date();
  const wake = at(now, 7, 0);
  const bedtime = at(now, 19, 0);
  const base = windowsForWeek(weekNumber);
  const clampMin = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
  const personalized = !!(opts.rhythm?.wakeMin || opts.rhythm?.napMin);
  const awake = clampMin(opts.rhythm?.wakeMin || base.awake, 30, 240);
  const nap = clampMin(opts.rhythm?.napMin || base.nap, 20, 180);
  const rhythmNote = personalized ? 'from your Playbook rhythm' : 'typical for this age';

  const slots: PlanSlot[] = [];
  const nudges: Nudge[] = [];
  const allDay: { id: string; title: string }[] = [];

  // Split calendar blocks: a "meeting" is a discrete timed event we can plan
  // around; anything ≥ 3h (conference days, travel) is context, shown as a
  // banner and NEVER used for collisions/slides (that was the pile-up bug).
  const LONG_MIN = 180;
  const dur = (b: BusyBlock) => (b.end.getTime() - b.start.getTime()) / 60000;
  const meetings = busy.filter((b) => dur(b) < LONG_MIN);
  busy.filter((b) => dur(b) >= LONG_MIN).forEach((b, i) => allDay.push({ id: `allday-${i}`, title: b.title }));

  meetings.forEach((b, i) => slots.push({
    id: `cal-${i}`, kind: 'calendar', title: b.title, start: b.start, end: b.end, source: 'calendar',
  }));

  const inMeeting = (s: Date, e: Date) => meetings.find((b) => overlaps(s, e, b.start, b.end));

  // Baby naps — awake window then nap, repeating until bedtime.
  let cursor = addMin(wake, awake);
  let n = 0;
  while (cursor < bedtime && n < 6) {
    let napStart = cursor;
    let title = `${babyName} — nap`;
    let note: string | undefined = `~${nap} min · ${rhythmNote}`;
    // Collision only with a real meeting → suggest putting baby down ~30 min
    // before it so they're settled.
    const clash = inMeeting(napStart, addMin(napStart, nap));
    if (clash) {
      const putDown = addMin(clash.start, -30);
      if (putDown > wake) {
        napStart = putDown;
        title = `Put ${babyName} down`;
        note = `so you're free for your ${clash.title} at ${fmtTime(clash.start)}`;
        // Only nudge for a meeting that's still ahead — a past collision is noise.
        if (clash.start.getTime() >= now.getTime()) {
          nudges.push({
            id: `nudge-${n}`,
            text: `your ${clash.title} at ${fmtTime(clash.start)} overlaps ${babyName}'s nap — try putting them down at ${fmtTime(napStart)}.`,
          });
        }
      }
    }
    slots.push({ id: `nap-${n}`, kind: 'nap', title, start: napStart, end: addMin(napStart, nap), note, source: 'villie' });
    cursor = addMin(napStart, nap + awake);
    n++;
  }

  // Feeds — every 3 hours from wake (light markers).
  for (let f = 0, t = new Date(wake); t <= bedtime && f < 7; f++, t = addMin(t, 180)) {
    slots.push({ id: `feed-${f}`, kind: 'feed', title: 'Feed', start: new Date(t), end: addMin(t, 20), note: 'every ~3 hrs', source: 'villie' });
  }

  // Pumps — per chosen cadence; if one lands inside a meeting, move it to just
  // AFTER that meeting ends (distinct time, no collapsing).
  const pumpTimes: Date[] =
    cadence === 'every_3h' ? [at(now, 9, 0), at(now, 12, 0), at(now, 15, 0)]
    : cadence === 'twice_shift' ? [at(now, 11, 0), at(now, 15, 0)]
    : cadence === 'morning_evening' ? [at(now, 7, 30), at(now, 20, 0)]
    : [];
  pumpTimes.forEach((t0, i) => {
    let t = t0;
    const m = inMeeting(t, addMin(t, 20));
    if (m) t = new Date(m.end);
    if (t < wake) t = wake;
    if (addMin(t, 20) > bedtime) t = addMin(bedtime, -20);
    slots.push({ id: `pump-${i}`, kind: 'pump', title: '🍼 Pump', start: t, end: addMin(t, 20), note: pumpNote(cadence), source: 'villie' });
  });

  // Apply the mom's per-block edits to villie's suggested slots (calendar slots
  // are never editable): drop dismissed ones, shift the rest by her adjustment.
  const ov = opts.overrides ?? {};
  const edited = slots.flatMap((sl) => {
    if (sl.source !== 'villie') return [sl];
    const o = ov[sl.id];
    if (!o) return [sl];
    if (o.dismissed) return [];
    if (o.shiftMin) {
      return [{ ...sl, start: addMin(sl.start, o.shiftMin), end: addMin(sl.end, o.shiftMin), note: sl.note ? `${sl.note} · you adjusted` : 'you adjusted' }];
    }
    return [sl];
  });

  // Hide already-past slots — the plan should only show what's still ahead (20
  // min grace so a just-started block lingers briefly).
  const cutoff = now.getTime() - 20 * 60000;
  const upcoming = edited
    .filter((s) => s.end.getTime() >= cutoff)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  return { slots: upcoming, nudges, allDay };
}

function pumpNote(c: PumpCadence): string {
  return c === 'every_3h' ? 'fits your every-3-hours'
    : c === 'twice_shift' ? 'during your work shift'
    : 'morning + evening';
}
