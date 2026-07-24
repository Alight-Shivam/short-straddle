import type { Trade } from '../../types/trade';
import { avg, groupBy, round2, sum, winRate } from '../_shared';
import { timeToBucketLabel, type TimeBucketStats } from './entryTime';

export interface ExitTimeReport {
  buckets: TimeBucketStats[];
  maxProfitTrade: Trade | null;
  maxLossTrade: Trade | null;
}

/** 9. Exit Time Analysis — bucketed stats plus the single biggest win/loss and when they exited. */
export function analyzeExitTime(trades: Trade[]): ExitTimeReport {
  const groups = groupBy(trades, (t) => timeToBucketLabel(t.exitTime));
  const buckets = [...groups.entries()]
    .map(([bucket, bucketTrades]) => ({
      bucket,
      totalTrades: bucketTrades.length,
      profit: round2(sum(bucketTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(bucketTrades)),
      averagePnl: round2(avg(bucketTrades.map((t) => t.pnl))),
    }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  const maxProfitTrade = trades.reduce<Trade | null>((best, t) => (!best || t.pnl > best.pnl ? t : best), null);
  const maxLossTrade = trades.reduce<Trade | null>((worst, t) => (!worst || t.pnl < worst.pnl ? t : worst), null);

  return { buckets, maxProfitTrade, maxLossTrade };
}
