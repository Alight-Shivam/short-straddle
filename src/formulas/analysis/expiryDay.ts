import type { Trade } from '../../types/trade';
import { avg, round2, sum, winRate } from '../_shared';

/**
 * NOTE: The CSV has no explicit "Expiry Date" column, so expiry classification
 * is a heuristic based on the day of the trade's entry date:
 *  - a trade entered on `EXPIRY_WEEKDAY` is treated as a "weekly expiry" trade
 *  - if that occurrence is also the LAST one in its month, it's reclassified
 *    as a "monthly expiry" trade
 *  - everything else is "non expiry"
 *
 * NIFTY weekly expiry has moved over the product's history (historically
 * Thursday; NSE shifted it to Tuesday from 2025). If your dataset spans a
 * different convention, change EXPIRY_WEEKDAY below (0=Sunday..6=Saturday) —
 * that's the only edit needed.
 */
export const EXPIRY_WEEKDAY = 4; // Thursday

export type ExpiryBucket = 'Weekly Expiry' | 'Monthly Expiry' | 'Non Expiry';

export interface ExpiryStats {
  bucket: ExpiryBucket;
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

function isLastWeekdayOccurrenceInMonth(d: Date): boolean {
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() + 7 > daysInMonth;
}

export function classifyExpiryBucket(entryDate: Date): ExpiryBucket {
  if (entryDate.getDay() !== EXPIRY_WEEKDAY) return 'Non Expiry';
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
