import { describe, it, expect } from 'vitest';
import {
  validateInterval, validateFeedShape, isRunaway,
  dayKeyLocal, groupByDay, minutesAgoISO, clampOz,
} from './logEntry';

const NOW = Date.parse('2026-08-13T15:00:00.000Z');

describe('validateInterval', () => {
  it('accepts a start before an end', () => {
    expect(validateInterval('2026-08-13T10:00:00Z', '2026-08-13T11:00:00Z', NOW).ok).toBe(true);
  });
  it('accepts a null end (session still running)', () => {
    expect(validateInterval('2026-08-13T10:00:00Z', null, NOW).ok).toBe(true);
  });
  it('rejects an end before its start', () => {
    const r = validateInterval('2026-08-13T11:00:00Z', '2026-08-13T10:00:00Z', NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/end/i);
  });
  it('rejects a start in the future', () => {
    expect(validateInterval('2026-08-13T16:00:00Z', null, NOW).ok).toBe(false);
  });
  it('rejects an end in the future', () => {
    expect(validateInterval('2026-08-13T10:00:00Z', '2026-08-13T16:00:00Z', NOW).ok).toBe(false);
  });
  it('rejects an unparseable timestamp', () => {
    expect(validateInterval('not-a-date', null, NOW).ok).toBe(false);
  });
  it('allows a zero-length session', () => {
    expect(validateInterval('2026-08-13T10:00:00Z', '2026-08-13T10:00:00Z', NOW).ok).toBe(true);
  });
});

describe('validateFeedShape', () => {
  it('accepts breast with a side and no oz', () => {
    expect(validateFeedShape('breast', 'left', null).ok).toBe(true);
  });
  it('accepts bottle with oz and no side', () => {
    expect(validateFeedShape('bottle', null, 4).ok).toBe(true);
  });
  it('rejects breast without a side', () => {
    expect(validateFeedShape('breast', null, null).ok).toBe(false);
  });
  it('rejects bottle carrying a side', () => {
    expect(validateFeedShape('bottle', 'left', 4).ok).toBe(false);
  });
  it('rejects breast carrying oz', () => {
    expect(validateFeedShape('breast', 'left', 4).ok).toBe(false);
  });
  it('rejects oz above the ceiling', () => {
    expect(validateFeedShape('bottle', null, 99).ok).toBe(false);
  });
  it('rejects negative oz', () => {
    expect(validateFeedShape('bottle', null, -1).ok).toBe(false);
  });
  it('allows a bottle with no recorded amount', () => {
    expect(validateFeedShape('bottle', null, null).ok).toBe(true);
  });
  it('rejects NaN ounces', () => {
    expect(validateFeedShape('bottle', null, NaN).ok).toBe(false);
  });
});

describe('isRunaway', () => {
  it('flags a sleep session past 12h', () => {
    expect(isRunaway('sleep', new Date(NOW - 13 * 3600_000).toISOString(), NOW)).toBe(true);
  });
  it('leaves a legitimate 8h overnight sleep alone', () => {
    expect(isRunaway('sleep', new Date(NOW - 8 * 3600_000).toISOString(), NOW)).toBe(false);
  });
  it('flags a feed past 2h', () => {
    expect(isRunaway('feed', new Date(NOW - 3 * 3600_000).toISOString(), NOW)).toBe(true);
  });
  it('leaves a 40m feed alone', () => {
    expect(isRunaway('feed', new Date(NOW - 40 * 60_000).toISOString(), NOW)).toBe(false);
  });
  it('does not flag a session exactly at the threshold', () => {
    expect(isRunaway('sleep', new Date(NOW - 12 * 3600_000).toISOString(), NOW)).toBe(false);
  });
  it('does not flag a session with an unparseable start', () => {
    expect(isRunaway('sleep', 'not-a-date', NOW)).toBe(false);
  });
});

describe('dayKeyLocal', () => {
  it('uses the local calendar day, not UTC', () => {
    // 01:00Z on Aug 13 is still Aug 12 in America/New_York (pinned in vitest.config).
    expect(dayKeyLocal('2026-08-13T01:00:00Z')).toBe('2026-08-12');
  });
  it('holds across a DST fall-back', () => {
    expect(dayKeyLocal('2026-11-01T05:30:00Z')).toBe('2026-11-01');
    expect(dayKeyLocal('2026-11-01T06:30:00Z')).toBe('2026-11-01');
  });
  it('treats a date-only string as that local day', () => {
    expect(dayKeyLocal('2026-08-12')).toBe('2026-08-12');
  });
});

describe('groupByDay', () => {
  it('groups by local day, newest day first, and preserves item order', () => {
    const items = [
      { id: 'a', at: '2026-08-13T18:00:00Z' },
      { id: 'b', at: '2026-08-13T19:00:00Z' },
      { id: 'c', at: '2026-08-11T18:00:00Z' },
    ];
    const groups = groupByDay(items, (i) => i.at);
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['c']);
    expect(groups[0].dayKey > groups[1].dayKey).toBe(true);
  });
  it('returns an empty array for no items', () => {
    expect(groupByDay([], (i: { at: string }) => i.at)).toEqual([]);
  });
  it('keeps an evening and a late-night log on the same local day', () => {
    // Both are Aug 12 in New York; the old UTC slice(0,10) split them in two.
    const items = [
      { id: 'evening', at: '2026-08-12T23:00:00Z' },
      { id: 'latenight', at: '2026-08-13T01:00:00Z' },
    ];
    const groups = groupByDay(items, (i) => i.at);
    expect(groups).toHaveLength(1);
    expect(groups[0].dayKey).toBe('2026-08-12');
  });
});

describe('minutesAgoISO', () => {
  it('subtracts the minutes from now', () => {
    expect(minutesAgoISO(30, NOW)).toBe(new Date(NOW - 30 * 60_000).toISOString());
  });
  it('returns now for zero', () => {
    expect(minutesAgoISO(0, NOW)).toBe(new Date(NOW).toISOString());
  });
});

describe('clampOz', () => {
  it('rounds to the nearest half ounce', () => {
    expect(clampOz(3.3)).toBe(3.5);
    expect(clampOz(3.1)).toBe(3);
  });
  it('clamps to the ceiling and floor', () => {
    expect(clampOz(99)).toBe(12);
    expect(clampOz(-4)).toBe(0);
  });
  it('rounds a tie up', () => {
    expect(clampOz(3.25)).toBe(3.5);
  });
  it('saturates infinities at the right end', () => {
    expect(clampOz(Infinity)).toBe(12);
    expect(clampOz(-Infinity)).toBe(0);
  });
});
