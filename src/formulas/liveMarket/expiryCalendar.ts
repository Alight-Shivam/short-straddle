import { expiryWeekdayFor } from '../analysis/expiryDay';

/**
 * "Given today (or any reference date), what's the next weekly/monthly
 * expiry?" — this is calendar arithmetic, not analytics over `Trade[]`, so it
 * lives in `liveMarket/` rather than `analysis/`. It deliberately reuses
 * `expiryWeekdayFor()` from `analysis/expiryDay.ts` (which already tracks the
 * Thursday->Tuesday NSE expiry-day change) instead of re-declaring the
 * schedule — one source of truth for "what weekday counts as expiry" no
 * matter which direction you're computing (classify a past trade vs. resolve
 * a future date).
 */

function atMidnight(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Formats a `Date` as "YYYY-MM-DD" using its LOCAL calendar components.
 * Deliberately not `date.toISOString().slice(0, 10)` — that converts to UTC
 * first, which silently shifts the date backward by a day for any local-
 * midnight `Date` in a timezone ahead of UTC (e.g. IST, UTC+5:30). Every
 * function in this file returns local-midnight `Date`s, so this is the only
 * safe way to turn one into a date-only string — use it at every API/UI
 * boundary instead of reaching for `toISOString()`.
 */
export function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The inverse of `formatDateOnly()` — parses "YYYY-MM-DD" as LOCAL midnight.
 * Deliberately not `new Date(dateOnlyString)`: that's parsed as UTC midnight
 * per spec, which is a different instant than local midnight in any
 * non-UTC timezone and is exactly what caused the bug `formatDateOnly()`
 * exists to avoid on the way back out. Returns `null` (not a Date holding
 * `NaN`) for anything that isn't a plain YYYY-MM-DD string, so callers can't
 * accidentally do date math on an Invalid Date.
 */
export function parseDateOnly(dateOnlyString: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnlyString.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  // Guards against e.g. "2024-02-30" silently rolling over into March.
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return null;
  return date;
}

function lastWeekdayOccurrenceInMonth(year: number, month0: number, weekday: number): Date {
  const lastDayOfMonth = new Date(year, month0 + 1, 0).getDate();
  for (let day = lastDayOfMonth; day >= 1; day--) {
    const candidate = new Date(year, month0, day);
    if (candidate.getDay() === weekday) return candidate;
  }
  // Unreachable: every weekday occurs at least 4 times in any month.
  throw new Error(`Could not find weekday ${weekday} in ${year}-${month0 + 1}`);
}

/** The next date on/after `referenceDate` that falls on that period's expiry weekday — i.e. the nearest weekly expiry. */
export function nextWeeklyExpiry(referenceDate: Date): Date {
  const d = atMidnight(referenceDate);
  for (let i = 0; i < 7; i++) {
    if (d.getDay() === expiryWeekdayFor(d)) return d;
    d.setDate(d.getDate() + 1);
  }
  // Unreachable: a full week always contains every weekday exactly once.
  throw new Error(`Could not resolve a weekly expiry within 7 days of ${referenceDate.toISOString()}`);
}

/** The nearest expiry overall — currently identical to the next weekly expiry, kept as its own named function since "nearest" and "weekly" are asked for as separate things in the spec and may diverge later (e.g. if a monthly expiry ever falls before the next weekly one). */
export function nearestExpiry(referenceDate: Date): Date {
  return nextWeeklyExpiry(referenceDate);
}

/** The monthly expiry (last occurrence of the expiry weekday in a month) covering `referenceDate` — rolls to next month if this month's has already passed. */
export function nextMonthlyExpiry(referenceDate: Date): Date {
  const ref = atMidnight(referenceDate);
  const weekday = expiryWeekdayFor(ref);
  const thisMonth = lastWeekdayOccurrenceInMonth(ref.getFullYear(), ref.getMonth(), weekday);
  if (thisMonth.getTime() >= ref.getTime()) return thisMonth;

  const nextMonthRef = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return lastWeekdayOccurrenceInMonth(nextMonthRef.getFullYear(), nextMonthRef.getMonth(), expiryWeekdayFor(nextMonthRef));
}

export type ExpiryKind = 'nearest' | 'weekly' | 'monthly';

/** Single entry point the API layer calls — dispatches to the right resolver above. */
export function resolveExpiry(kind: ExpiryKind, referenceDate: Date = new Date()): Date {
  switch (kind) {
    case 'nearest':
      return nearestExpiry(referenceDate);
    case 'weekly':
      return nextWeeklyExpiry(referenceDate);
    case 'monthly':
      return nextMonthlyExpiry(referenceDate);
  }
}
