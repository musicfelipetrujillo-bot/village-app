// Test coverage plan, tier 4 — the ZIP and due-date helpers.
//
// Both are shared by Onboarding and Edit Profile, and both sit on the boundary
// between what a tired one-handed user types and what Postgres stores. The
// due-date pair is the one with teeth: the column is a `DATE`, so a value that
// reaches it in the wrong order is not rejected — it is stored as a different
// day. Onboarding once passed the masked MM/DD/YYYY string straight into the
// column and relied on Postgres's DateStyle to parse it.

import { describe, it, expect } from 'vitest';
import { formatZipInput, isPlausibleZip } from './zip';
import { formatDueDateInput, isPlausibleDueDate, toIsoDate, fromIsoDate } from './dueDate';

describe('ZIP input mask', () => {
  it('keeps five digits plain', () => {
    expect(formatZipInput('33101')).toBe('33101');
  });

  it('hyphenates ZIP+4 as it is typed', () => {
    expect(formatZipInput('331011234')).toBe('33101-1234');
  });

  it('strips anything that is not a digit', () => {
    expect(formatZipInput('3a3b1c0d1')).toBe('33101');
    expect(formatZipInput('33101-1234')).toBe('33101-1234');
  });

  it('stops at nine digits so a leaned-on key cannot overflow the field', () => {
    // 13 digits in, the first 9 kept: 33101 + 1234.
    expect(formatZipInput('3310112345555')).toBe('33101-1234');
  });
});

describe('ZIP validation', () => {
  it('accepts empty — the field is optional', () => {
    expect(isPlausibleZip('')).toBe(true);
  });

  it('accepts 5 and 5+4', () => {
    expect(isPlausibleZip('33101')).toBe(true);
    expect(isPlausibleZip('33101-1234')).toBe(true);
  });

  it('rejects the partly-typed and the malformed', () => {
    expect(isPlausibleZip('331')).toBe(false);
    expect(isPlausibleZip('33101-12')).toBe(false);
    expect(isPlausibleZip('ABCDE')).toBe(false);
  });
});

describe('due-date input mask', () => {
  it('inserts the slashes as the user types', () => {
    expect(formatDueDateInput('0')).toBe('0');
    expect(formatDueDateInput('06')).toBe('06');
    expect(formatDueDateInput('0615')).toBe('06/15');
    expect(formatDueDateInput('06152026')).toBe('06/15/2026');
  });

  it('ignores non-digits and stops at eight digits', () => {
    expect(formatDueDateInput('06/15/2026')).toBe('06/15/2026');
    expect(formatDueDateInput('061520261111')).toBe('06/15/2026');
  });
});

describe('due-date validation', () => {
  const thisYear = new Date().getFullYear();

  it('accepts empty — optional field', () => {
    expect(isPlausibleDueDate('')).toBe(true);
  });

  it('accepts a well-formed date in the plausible year window', () => {
    expect(isPlausibleDueDate(`06/15/${thisYear}`)).toBe(true);
    expect(isPlausibleDueDate(`01/01/${thisYear + 2}`)).toBe(true);
    expect(isPlausibleDueDate(`12/31/${thisYear - 1}`)).toBe(true);
  });

  it('rejects a year outside that window — the "1999" typo', () => {
    expect(isPlausibleDueDate('06/15/1999')).toBe(false);
    expect(isPlausibleDueDate(`06/15/${thisYear + 3}`)).toBe(false);
  });

  it('rejects impossible months and days', () => {
    expect(isPlausibleDueDate(`13/01/${thisYear}`)).toBe(false);
    expect(isPlausibleDueDate(`00/01/${thisYear}`)).toBe(false);
    expect(isPlausibleDueDate(`06/32/${thisYear}`)).toBe(false);
    expect(isPlausibleDueDate(`06/00/${thisYear}`)).toBe(false);
  });

  it('rejects an unpadded or incomplete shape', () => {
    expect(isPlausibleDueDate(`6/15/${thisYear}`)).toBe(false);
    expect(isPlausibleDueDate('06/15')).toBe(false);
  });
});

describe('the DB boundary — MM/DD/YYYY ↔ ISO', () => {
  it('converts to ISO for Postgres', () => {
    expect(toIsoDate('06/15/2026')).toBe('2026-06-15');
  });

  it('returns null rather than a guess on bad input', () => {
    // Null clears the column. A guess would store a real but WRONG date, which
    // is worse — nothing downstream could tell it was never entered properly.
    expect(toIsoDate('')).toBeNull();
    expect(toIsoDate('6/15/2026')).toBeNull();
    expect(toIsoDate('2026-06-15')).toBeNull();
    expect(toIsoDate('nonsense')).toBeNull();
  });

  it('renders an ISO column back as MM/DD/YYYY', () => {
    expect(fromIsoDate('2026-06-15')).toBe('06/15/2026');
  });

  it('tolerates a full timestamp, since some columns carry one', () => {
    expect(fromIsoDate('2026-06-15T00:00:00Z')).toBe('06/15/2026');
  });

  it('renders empty for null, undefined or junk instead of "NaN/NaN"', () => {
    expect(fromIsoDate(null)).toBe('');
    expect(fromIsoDate(undefined)).toBe('');
    expect(fromIsoDate('not-a-date')).toBe('');
  });

  it('round-trips without drifting a day', () => {
    // The failure mode worth pinning: month/day transposition survives a naive
    // check because both halves are two digits. 06/15 must never become 15/06.
    for (const iso of ['2026-01-31', '2026-06-15', '2026-12-01']) {
      expect(toIsoDate(fromIsoDate(iso))).toBe(iso);
    }
  });
});
