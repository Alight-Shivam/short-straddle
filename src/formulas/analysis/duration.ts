import type { Trade } from '../../types/trade';
import { avg, round2, sum, winRate } from '../_shared';

/** Upper bounds (minutes) for each duration bucket. Edit here to re-bucket. */
export const DURATION_BUCKET_BOUNDS_MIN = [5, 10, 20, 30, 60, 120];

export interface DurationBucketStats {
  bucket: string; // "<=5 min" ... ">2 hr"
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

function labelFor(lo: number, hi: number): string {
  const fmt = (m: number) => (m % 60 === 0 && m > 0 ? `${m / 60} hr` : `${m} min`);
  if (lo === 0) return `<= ${fmt(hi)}`;
  if (hi === Infinity) return `> ${fmt(lo)}`;
  return `${fmt(lo)} - ${fmt(hi)}`;
}

/** 18. Trade Duration Analysis. */
export function analyzeDuration(trades: Trade[]): DurationBucketStats[] {
  const bounds = [0, ...DURATION_BUCKET_BOUNDS_MIN, Infinity];
  const out: DurationBucketStats[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const lo = bounds[i];
    const hi = bounds[i + 1];
    const bucketTrades = trades.filter((t) => t.durationMinutes > lo && t.durationMinutes <= hi || (lo === 0 && t.durationMinutes === 0));
    out.push({
      bucket: labelFor(lo, hi),
      totalTrades: bucketTrades.length,
      profit: round2(sum(bucketTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(bucketTrades)),
      averagePnl: round2(avg(bucketTrades.map((t) => t.pnl))),
    });
  }
  return out;
}
