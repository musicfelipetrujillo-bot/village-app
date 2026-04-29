// Client-side mirror of `supabase/functions/_shared/quiet-hours.ts` —
// kept in sync intentionally so a UI badge / Home indicator can reflect
// the same window the server uses to suppress pushes.
//
// Fail-soft: missing/malformed prefs return false (not quiet). Never
// silently darken the UI from bad data.
//
// Note: the user's saved tz drives the calculation (not the device tz),
// because the user may have set their quiet window from a phone in a
// different timezone (e.g. travel) and expect the rule to still apply
// to their home schedule.

import type { QuietHours } from '@store/user';

function readHourInTz(now: Date, tz: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const hourPart = parts.find((p) => p.type === 'hour')?.value;
    if (!hourPart) return null;
    const n = parseInt(hourPart, 10);
    if (!Number.isFinite(n)) return null;
    return n === 24 ? 0 : n;
  } catch {
    return null;
  }
}

export function isQuietHoursActive(
  qh: QuietHours | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!qh || !qh.enabled) return false;
  const { start_hour: start, end_hour: end, tz } = qh;
  if (typeof start !== 'number' || typeof end !== 'number' || !tz) return false;
  if (start < 0 || start > 23 || end < 0 || end > 23) return false;
  if (start === end) return false;

  const hour = readHourInTz(now, tz);
  if (hour === null) return false;

  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

// 12-hour AM/PM display matching NotificationPreferencesScreen so the Home
// indicator and the settings screen agree on copy.
export function formatHour12(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const ampm = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${ampm}`;
}
