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
    expect(r.reason).toMatch(/end/i);
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
});

describe('dayKeyLocal', () => {
  it('uses the local calendar day, not UTC', () => {
    // 2026-08-13T01:00:00Z is still Aug 12 in any Americas timezone.
    const d = new Date('2026-08-13T01:00:00Z');
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(dayKeyLocal('2026-08-13T01:00:00Z')).toBe(expected);
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
});
