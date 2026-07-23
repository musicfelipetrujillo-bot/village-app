// calendar.ts — READ-ONLY device-calendar access for the day planner.
// We only ever read free/busy windows for today; we never store or transmit
// event titles beyond the on-device plan. expo-calendar is already in the
// binary (event RSVP uses it) and the Info.plist declares full-access, so this
// ships OTA.
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
