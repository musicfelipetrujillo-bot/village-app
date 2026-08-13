// calendar.ts — device-calendar access for the day planner.
//
// READ: free/busy windows only. We never store or transmit event titles beyond
// the on-device plan.
//
// WRITE (`syncPlanToCalendar`, added 2026-08-12): pushes villie's OWN plan
// slots — naps, feeds, pumps — into her calendar so the plan survives leaving
// the app. It never touches, edits, or deletes an event villie didn't create.
//
// expo-calendar is already in the binary (event RSVP uses it) and the
// Info.plist declares full access, so all of this ships OTA.
import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

export type BusyBlock = { title: string; start: Date; end: Date };

export async function getCalendarPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status as 'granted' | 'denied' | 'undetermined';
  } catch {
    return 'undetermined';
  }
}

export async function requestCalendarAccess(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ── write-back ──────────────────────────────────────────────────────────────
// Everything villie writes goes into ONE dedicated calendar, never her personal
// ones. That single decision buys the three properties that matter:
//   1. She can hide or delete the whole thing in one tap in her own Calendar
//      app, without us needing a "disconnect" flow that deletes her data.
//   2. We can clear and rewrite the day without any risk of touching an event
//      she or someone else created — we only ever delete inside our own
//      calendar, so a bug here cannot eat her real appointments.
//   3. Re-syncing is idempotent: clear our day, write our day. No dedupe
//      heuristics on titles, which is where this kind of feature usually rots.
const VILLIE_CAL_TITLE = 'villie';
const VILLIE_CAL_COLOR = '#C24A63';

async function findVillieCalendar(): Promise<Calendar.Calendar | null> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return cals.find((c) => c.title === VILLIE_CAL_TITLE && c.allowsModifications) ?? null;
}

async function getOrCreateVillieCalendar(): Promise<string | null> {
  try {
    const existing = await findVillieCalendar();
    if (existing) return existing.id;

    // iOS requires a source; Android requires an account. Reuse the device's
    // default so the calendar lands somewhere that actually syncs, rather than
    // creating a local-only calendar that silently vanishes on device change.
    if (Platform.OS === 'ios') {
      const def = await Calendar.getDefaultCalendarAsync();
      if (!def?.source) return null;
      return await Calendar.createCalendarAsync({
        title: VILLIE_CAL_TITLE,
        color: VILLIE_CAL_COLOR,
        entityType: Calendar.EntityTypes.EVENT,
        sourceId: def.source.id,
        name: VILLIE_CAL_TITLE,
        ownerAccount: 'personal',
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });
    }

    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = cals.find((c) => c.allowsModifications);
    return await Calendar.createCalendarAsync({
      title: VILLIE_CAL_TITLE,
      color: VILLIE_CAL_COLOR,
      entityType: Calendar.EntityTypes.EVENT,
      name: VILLIE_CAL_TITLE,
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
      ownerAccount: writable?.ownerAccount ?? 'personal',
      source: writable?.source
        ? { isLocalAccount: true, name: writable.source.name, type: writable.source.type }
        : undefined,
    } as any);
  } catch {
    return null;
  }
}

export type SyncResult =
  | { ok: true; written: number; replaced: number }
  | { ok: false; reason: 'permission' | 'no_calendar' | 'nothing_to_sync' | 'failed' };

/**
 * Writes villie's plan slots for one day into the villie calendar, replacing
 * whatever we wrote there before for that same day.
 *
 * Only `source: 'villie'` slots are written. Calendar-sourced slots came FROM
 * her calendar — writing them back would duplicate her own meetings, which is
 * the single most obvious way a feature like this loses trust.
 */
export async function syncPlanToCalendar(
  slots: { kind: string; title: string; start: Date; end: Date; note?: string; source: string }[],
  day: Date = new Date(),
): Promise<SyncResult> {
  try {
    if ((await getCalendarPermission()) !== 'granted') return { ok: false, reason: 'permission' };

    const mine = slots.filter((s) => s.source === 'villie' && s.end > s.start);
    if (!mine.length) return { ok: false, reason: 'nothing_to_sync' };

    const calId = await getOrCreateVillieCalendar();
    if (!calId) return { ok: false, reason: 'no_calendar' };

    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);

    // Clear only OUR calendar for OUR day, so a re-sync updates in place
    // instead of stacking duplicates every time she taps the button.
    let replaced = 0;
    try {
      const old = await Calendar.getEventsAsync([calId], dayStart, dayEnd);
      for (const e of old) {
        try { await Calendar.deleteEventAsync(e.id); replaced += 1; } catch { /* keep going */ }
      }
    } catch { /* first run — nothing to clear */ }

    let written = 0;
    for (const slot of mine) {
      try {
        await Calendar.createEventAsync(calId, {
          title: slot.title,
          startDate: slot.start,
          endDate: slot.end,
          notes: slot.note ? `${slot.note}\n\nAdded by villie.` : 'Added by villie.',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          // No alarms. A postpartum mom does not need her phone buzzing at
          // every planned nap — the plan is a guide, not a set of alerts.
          alarms: [],
        });
        written += 1;
      } catch { /* skip the slot, keep the rest */ }
    }

    if (!written) return { ok: false, reason: 'failed' };
    return { ok: true, written, replaced };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

// Today's timed events across every event calendar, as busy blocks. All-day
// events are dropped (they don't block a specific hour), and the list is sorted.
export async function getTodayBusyBlocks(now: Date = new Date()): Promise<BusyBlock[]> {
  try {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const ids = cals.map((c) => c.id);
    if (!ids.length) return [];
    const events = await Calendar.getEventsAsync(ids, start, end);
    return events
      .filter((e) => !e.allDay && e.startDate && e.endDate)
      .map((e) => {
        // Clamp to today — a multi-day event (e.g. a week-long conference)
        // otherwise carries a prior-day start that mis-sorts + mis-displays.
        const raw0 = new Date(e.startDate as string).getTime();
        const raw1 = new Date(e.endDate as string).getTime();
        return {
          title: e.title?.trim() || 'Busy',
          start: new Date(Math.max(raw0, start.getTime())),
          end: new Date(Math.min(raw1, end.getTime())),
        };
      })
      .filter((b) => b.end.getTime() - b.start.getTime() >= 5 * 60000) // drop slivers
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  } catch {
    return [];
  }
}

// Busy windows for today + the next `days` days as ISO strings, TITLES STRIPPED —
// for the assistant's "fits my schedule" reasoning. Privacy: times only, nothing
// about what the events are. Returns [] if permission isn't granted.
export async function getUpcomingBusy(days = 6, now: Date = new Date()): Promise<{ start: string; end: string }[]> {
  try {
    if ((await getCalendarPermission()) !== 'granted') return [];
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setDate(end.getDate() + days); end.setHours(23, 59, 59, 999);
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const ids = cals.map((c) => c.id);
    if (!ids.length) return [];
    const events = await Calendar.getEventsAsync(ids, start, end);
    return events
      .filter((e) => !e.allDay && e.startDate && e.endDate)
      .map((e) => ({ start: new Date(e.startDate as string).toISOString(), end: new Date(e.endDate as string).toISOString() }))
      .filter((b) => new Date(b.end).getTime() > new Date(b.start).getTime())
      .slice(0, 60);
  } catch {
    return [];
  }
}
