// Shared quiet-hours check for notification senders.
//
// Shape stored on `users.notif_prefs.quiet_hours`:
//   {
//     enabled:    boolean,
//     start_hour: number (0..23),  // inclusive
//     end_hour:   number (0..23),  // exclusive
//     tz:         IANA timezone string (e.g. "America/New_York")
//   }
//
// Night-wrapping ranges are supported (e.g. start=22, end=7 = 22:00 → 06:59).
//
// Policy:
//   • Only NON-urgent surfaces (weekly digests, appointment reminders) should
//     call this. Crisis-tier SMS (moderator crisis, admin approvals) and
//     transactional account-status notifications BYPASS this check.
//   • If quiet_hours is missing / malformed / disabled, returns false (not
//     quiet — send normally). Never fail closed on malformed data, because a
//     surprise silencing is worse UX than an extra nudge.

export interface QuietHours {
  enabled: boolean;
  start_hour: number;
  end_hour: number;
  tz: string;
}

function readHourInTz(now: Date, tz: string): number | null {
  try {
    // Intl is available in Deno. `formatToParts` gives us the hour in the
    // requested timezone without having to convert offsets by hand.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const hourPart = parts.find((p) => p.type === 'hour')?.value;
    if (!hourPart) return null;
    // `en-US` with hour12:false can emit "24" for midnight on some engines; fold to 0.
    const n = parseInt(hourPart, 10);
    if (!Number.isFinite(n)) return null;
    return n === 24 ? 0 : n;
  } catch {
    // Unknown tz string → treat as not-quiet so we don't silently black-hole.
    return null;
  }
}

export function isQuietHoursActive(
  prefs: { quiet_hours?: Partial<QuietHours> | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  const qh = prefs?.quiet_hours;
  if (!qh || !qh.enabled) return false;
  const start = qh.start_hour;
  const end   = qh.end_hour;
  const tz    = qh.tz;
  if (typeof start !== 'number' || typeof end !== 'number' || !tz) return false;
  if (start < 0 || start > 23 || end < 0 || end > 23) return false;
  // A matching start/end means "no quiet window" — don't silence 24/7.
  if (start === end) return false;

  const hour = readHourInTz(now, tz);
  if (hour === null) return false;

  if (start < end) {
    // Same-day window, e.g. 13..17 means 13:00–16:59.
    return hour >= start && hour < end;
  }
  // Night-wrapping window, e.g. 22..7 means 22:00–06:59.
  return hour >= start || hour < end;
}
