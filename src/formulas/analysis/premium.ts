import type { Trade } from '../../types/trade';
import { avg, round2, sum, winRate } from '../_shared';

/** Entry-premium (CE+PE combined) range buckets in rupees. Edit freely to re-bucket. */
export const PREMIUM_RANGE_BOUNDS = [0, 50, 100, 150, 200, 300, 400, 600, Infinity];

export interface PremiumRangeStats {
  range: string; // "100-150"
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

function rangeLabel(lo: number, hi: number): string {
  return hi === Infinity ? `${lo}+` : `${lo}-${hi}`;
}

/** 10. Premium Analysis — entry premium ranges vs profit. */
export function analyzePremiumRanges(trades: Trade[]): PremiumRangeStats[] {
  const withPremium = trades.filter((t) => t.entryPremiumTotal !== null);
  const out: PremiumRangeStats[] = [];
  for (let i = 0; i < PREMIUM_RANGE_BOUNDS.length - 1; i++) {
    const lo = PREMIUM_RANGE_BOUNDS[i];
    const hi = PREMIUM_RANGE_BOUNDS[i + 1];
    const bucketTrades = withPremium.filter((t) => (t.entryPremiumTotal ?? 0) >= lo && (t.entryPremiumTotal ?? 0) < hi);
    out.push({
      range: rangeLabel(lo, hi),
      totalTrades: bucketTrades.length,
      profit: round2(sum(bucketTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(bucketTrades)),
      averagePnl: round2(avg(bucketTrades.map((t) => t.pnl))),
    });
  }
  return out;
}
