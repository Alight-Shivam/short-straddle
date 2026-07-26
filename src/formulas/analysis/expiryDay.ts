import type { Trade } from '../../types/trade';
import { avg, round2, sum, winRate } from '../_shared';

/**
 * NOTE: The CSV has no explicit "Expiry Date" column, so expiry classification
 * is a heuristic based on the day of the trade's entry date:
 *  - a trade entered on that period's NIFTY weekly-expiry weekday is treated
 *    as a "weekly expiry" trade
 *  - if that occurrence is also the LAST one in its month, it's reclassified
 *    as a "monthly expiry" trade
 *  - everything else is "non expiry"
 *
 * IMPORTANT — the expiry weekday is NOT constant, it has changed by NSE
 * circular over time (verified against NSE/exchange bulletins, July 2026):
 *   - Thursday: original convention, in force until August 2025
 *   - Tuesday: NSE shifted NIFTY/BANKNIFTY/FINNIFTY/MIDCPNIFTY/stock F&O
 *     expiry to Tuesday effective 2025-09-02 (a March 2025 circular had
 *     proposed Monday effective 2025-04-04 but that change was withdrawn
 *     before taking effect, so it is intentionally NOT in this table)
 * `EXPIRY_WEEKDAY_SCHEDULE` is a chronological list of (effective-from date,
 * weekday) pairs — classification picks the entry matching the trade's own
 * entry date, so a dataset spanning the cutover (like the sample data, which
 * runs 2020-2026) is classified correctly on both sides of the change. If
 * NSE moves it again, add one more row here; nothing else needs to change.
 */
export const EXPIRY_WEEKDAY_SCHEDULE: { effectiveFrom: Date; weekday: number; label: string }[] = [
  { effectiveFrom: new Date(1900, 0, 1), weekday: 4, label: 'Thursday (original NSE convention)' },
  { effectiveFrom: new Date(2025, 8, 2), weekday: 2, label: 'Tuesday (NSE circular, effective 2025-09-02)' },
];

export type ExpiryBucket = 'Weekly Expiry' | 'Monthly Expiry' | 'Non Expiry';

export interface ExpiryStats {
  bucket: ExpiryBucket;
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

/** Which weekday counted as "expiry" on the given date, per `EXPIRY_WEEKDAY_SCHEDULE`. */
export function expiryWeekdayFor(date: Date): number {
  let current = EXPIRY_WEEKDAY_SCHEDULE[0].weekday;
  for (const rule of EXPIRY_WEEKDAY_SCHEDULE) {
    if (date.getTime() >= rule.effectiveFrom.getTime()) current = rule.weekday;
    else break;
  }
  return current;
}

function isLastWeekdayOccurrenceInMonth(d: Date): boolean {
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() + 7 > daysInMonth;
}

export function classifyExpiryBucket(entryDate: Date): ExpiryBucket {
  if (entryDate.getDay() !== expiryWeekdayFor(entryDate)) return 'Non Expiry';
  return isLastWeekdayOccurrenceInMonth(entryDate) ? 'Monthly Expiry' : 'Weekly Expiry';
}

/** 7. Expiry Day Analysis. */
export function analyzeExpiryDay(trades: Trade[]): ExpiryStats[] {
  const buckets: ExpiryBucket[] = ['Weekly Expiry', 'Monthly Expiry', 'Non Expiry'];
  return buckets.map((bucket) => {
    const bucketTrades = trades.filter((t) => classifyExpiryBucket(t.entryDate) === bucket);
    return {
      bucket,
      totalTrades: bucketTrades.length,
      profit: round2(sum(bucketTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(bucketTrades)),
      averagePnl: round2(avg(bucketTrades.map((t) => t.pnl))),
    };
  });
}
