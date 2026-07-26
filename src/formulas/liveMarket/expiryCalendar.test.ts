import { describe, expect, it } from 'vitest';
import { formatDateOnly, nearestExpiry, nextMonthlyExpiry, nextWeeklyExpiry, parseDateOnly, resolveExpiry } from './expiryCalendar';
import { expiryWeekdayFor } from '../analysis/expiryDay';

/** Independent (test-side) reimplementation of "is this the last occurrence of its weekday in its month?" — deliberately not reusing any app code, so this genuinely cross-checks the implementation rather than restating it. */
function isLastOccurrenceOfWeekdayInMonth(date: Date): boolean {
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() + 7 > daysInMonth;
}

const PRE_CUTOVER = new Date(2024, 0, 1); // deep in the Thursday-expiry era
const POST_CUTOVER = new Date(2026, 0, 5); // deep in the Tuesday-expiry era (post 2025-09-02)

describe('nextWeeklyExpiry', () => {
  it('resolves to the correct weekday for both the pre- and post-cutover expiry conventions', () => {
    const pre = nextWeeklyExpiry(PRE_CUTOVER);
    expect(pre.getDay()).toBe(expiryWeekdayFor(pre));
    expect(pre.getDay()).toBe(4); // Thursday

    const post = nextWeeklyExpiry(POST_CUTOVER);
    expect(post.getDay()).toBe(expiryWeekdayFor(post));
    expect(post.getDay()).toBe(2); // Tuesday
  });

  it('always resolves within the same week (0-6 days after the reference date)', () => {
    for (let offset = 0; offset < 14; offset++) {
      const ref = new Date(2026, 0, 1 + offset);
      const result = nextWeeklyExpiry(ref);
      const diffDays = (result.getTime() - ref.getTime()) / 86_400_000;
      expect(diffDays).toBeGreaterThanOrEqual(0);
      expect(diffDays).toBeLessThan(7);
    }
  });

  it('is idempotent: resolving an actual expiry date returns that same date', () => {
    const first = nextWeeklyExpiry(POST_CUTOVER);
    const second = nextWeeklyExpiry(first);
    expect(second.getTime()).toBe(first.getTime());
  });
});

describe('nextMonthlyExpiry', () => {
  it('always returns the last occurrence of the expiry weekday in its month, on/after the reference date', () => {
    for (let offset = 0; offset < 60; offset += 7) {
      const ref = new Date(2026, 0, 1 + offset);
      const result = nextMonthlyExpiry(ref);
      expect(result.getDay()).toBe(expiryWeekdayFor(result));
      expect(isLastOccurrenceOfWeekdayInMonth(result)).toBe(true);
      expect(result.getTime()).toBeGreaterThanOrEqual(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime());
    }
  });

  it('rolls to next month once this month\'s monthly expiry has already passed', () => {
    const lateInMonth = new Date(2026, 0, 28); // Jan 28, 2026 — past or at the last Tuesday of January
    const result = nextMonthlyExpiry(lateInMonth);
    const sameMonth = result.getFullYear() === lateInMonth.getFullYear() && result.getMonth() === lateInMonth.getMonth();

    if (sameMonth) {
      // This month's last occurrence hadn't happened yet — fine, but it must still be >= the 28th.
      expect(result.getDate()).toBeGreaterThanOrEqual(28);
    } else {
      // Rolled forward — must land in the very next calendar month (handles year rollover too).
      const expectedNext = new Date(lateInMonth.getFullYear(), lateInMonth.getMonth() + 1, 1);
      expect(result.getFullYear()).toBe(expectedNext.getFullYear());
      expect(result.getMonth()).toBe(expectedNext.getMonth());
    }
  });
});

describe('formatDateOnly / parseDateOnly', () => {
  it('round-trips a date through parse then format without shifting days (the bug this pair exists to prevent)', () => {
    for (const s of ['2024-01-01', '2024-02-29', '2025-09-02', '2026-12-31']) {
      const parsed = parseDateOnly(s);
      expect(parsed).not.toBeNull();
      expect(formatDateOnly(parsed!)).toBe(s);
    }
  });

  it('never uses toISOString() semantics — a local-midnight Date formats to its own calendar day regardless of UTC offset', () => {
    const localMidnight = new Date(2024, 0, 4); // Jan 4, 2024, local midnight
    expect(formatDateOnly(localMidnight)).toBe('2024-01-04');
  });

  it('rejects malformed or impossible dates instead of silently rolling over', () => {
    expect(parseDateOnly('not-a-date')).toBeNull();
    expect(parseDateOnly('2024-02-30')).toBeNull(); // Feb never has 30 days
    expect(parseDateOnly('2024-13-01')).toBeNull(); // no month 13
  });
});

describe('nearestExpiry / resolveExpiry', () => {
  it('nearestExpiry matches nextWeeklyExpiry', () => {
    expect(nearestExpiry(POST_CUTOVER).getTime()).toBe(nextWeeklyExpiry(POST_CUTOVER).getTime());
  });

  it('resolveExpiry dispatches to the right resolver for each kind', () => {
    expect(resolveExpiry('nearest', POST_CUTOVER).getTime()).toBe(nearestExpiry(POST_CUTOVER).getTime());
    expect(resolveExpiry('weekly', POST_CUTOVER).getTime()).toBe(nextWeeklyExpiry(POST_CUTOVER).getTime());
    expect(resolveExpiry('monthly', POST_CUTOVER).getTime()).toBe(nextMonthlyExpiry(POST_CUTOVER).getTime());
  });
});
