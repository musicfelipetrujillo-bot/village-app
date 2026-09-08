// Test coverage plan, tier 4 — quiet hours.
//
// This decides whether a push reaches a postpartum mother at 3am. The window
// usually WRAPS midnight (22:00 → 07:00), which is the case naive comparisons
// get wrong, and it is evaluated in HER saved timezone rather than the device's,
// because she may have set it while travelling.
//
// The client copy mirrors `supabase/functions/_shared/quiet-hours.ts`. Only the
// server's copy actually suppresses a send; this one drives the Home indicator.
// They are kept in sync by hand, so the wrap and fail-soft cases are pinned here.

import { describe, it, expect } from 'vitest';
import { isQuietHoursActive, formatHour12 } from './quietHours';

const NY = 'America/New_York';
const qh = (over: Record<string, unknown> = {}) => ({
  enabled: true, start_hour: 22, end_hour: 7, tz: NY, ...over,
} as never);

/** A UTC instant that is `hour` local time in New York (EST, UTC-5, in January). */
const nyAt = (hour: number) => new Date(Date.UTC(2026, 0, 15, (hour + 5) % 24, 30));

describe('the wrapping window (22:00 → 07:00) — the case naive code gets wrong', () => {
  it('is quiet late at night, after the start', () => {
    expect(isQuietHoursActive(qh(), nyAt(23))).toBe(true);
  });

  it('is quiet in the small hours, before the end', () => {
    expect(isQuietHoursActive(qh(), nyAt(3))).toBe(true);
  });

  it('is NOT quiet during the day', () => {
    expect(isQuietHoursActive(qh(), nyAt(12))).toBe(false);
  });

  it('includes the start hour and excludes the end hour', () => {
    // Half-open by design: a 22:00–07:00 window covers 22:00 and releases at
    // 07:00 sharp. An inclusive end would hold the 7am nudge for an hour.
    expect(isQuietHoursActive(qh(), nyAt(22))).toBe(true);
    expect(isQuietHoursActive(qh(), nyAt(7))).toBe(false);
    expect(isQuietHoursActive(qh(), nyAt(6))).toBe(true);
  });
});

describe('the same-day window (09:00 → 17:00)', () => {
  const day = qh({ start_hour: 9, end_hour: 17 });
  it('is quiet inside it and loud outside it', () => {
    expect(isQuietHoursActive(day, nyAt(10))).toBe(true);
    expect(isQuietHoursActive(day, nyAt(9))).toBe(true);
    expect(isQuietHoursActive(day, nyAt(17))).toBe(false);
    expect(isQuietHoursActive(day, nyAt(3))).toBe(false);
  });
});

describe('her timezone, not the device timezone', () => {
  it('evaluates against the saved tz', () => {
    // One instant, two saved timezones, two answers. 03:30 New York is 08:30 in
    // London — quiet for her, not quiet for a London profile.
    const instant = nyAt(3);
    expect(isQuietHoursActive(qh({ tz: NY }), instant)).toBe(true);
    expect(isQuietHoursActive(qh({ tz: 'Europe/London' }), instant)).toBe(false);
  });
});

describe('fail-soft — never darken the UI from bad data', () => {
  it('is not quiet when disabled or absent', () => {
    expect(isQuietHoursActive(qh({ enabled: false }), nyAt(3))).toBe(false);
    expect(isQuietHoursActive(null, nyAt(3))).toBe(false);
    expect(isQuietHoursActive(undefined, nyAt(3))).toBe(false);
  });

  it('is not quiet on a malformed or out-of-range window', () => {
    expect(isQuietHoursActive(qh({ start_hour: -1 }), nyAt(3))).toBe(false);
    expect(isQuietHoursActive(qh({ end_hour: 24 }), nyAt(3))).toBe(false);
    expect(isQuietHoursActive(qh({ start_hour: '22' }), nyAt(3))).toBe(false);
    expect(isQuietHoursActive(qh({ tz: '' }), nyAt(3))).toBe(false);
  });

  it('is not quiet on an unknown timezone rather than throwing', () => {
    // A bad tz must not black-hole the indicator with an exception.
    expect(isQuietHoursActive(qh({ tz: 'Mars/Olympus_Mons' }), nyAt(3))).toBe(false);
  });

  it('treats start === end as no window at all, not a 24-hour one', () => {
    // Ambiguous input. Silencing every push for a full day would be the worst
    // possible reading of it.
    expect(isQuietHoursActive(qh({ start_hour: 22, end_hour: 22 }), nyAt(22))).toBe(false);
    expect(isQuietHoursActive(qh({ start_hour: 22, end_hour: 22 }), nyAt(3))).toBe(false);
  });
});

describe('formatHour12', () => {
  it('renders the hours a settings screen actually shows', () => {
    expect(formatHour12(0)).toBe('12 AM');
    expect(formatHour12(7)).toBe('7 AM');
    expect(formatHour12(12)).toBe('12 PM');
    expect(formatHour12(22)).toBe('10 PM');
  });

  it('wraps out-of-range input instead of printing nonsense', () => {
    expect(formatHour12(24)).toBe('12 AM');
    expect(formatHour12(-1)).toBe('11 PM');
  });
});
