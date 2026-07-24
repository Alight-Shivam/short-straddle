import type { Trade } from '../../types/trade';
import { avg, groupBy, round2, sum, winRate } from '../_shared';

export interface TimeBucketStats {
  bucket: string; // "09:15-09:30"
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

/** Bucket width (minutes) for entry/exit time-of-day grouping. Change here to re-granularize. */
export const TIME_BUCKET_MINUTES = 15;

export function timeToBucketLabel(hhmmss: string, widthMinutes = TIME_BUCKET_MINUTES): string {
  const [h, m] = hhmmss.split(':').map(Number);
  const totalMin = h * 60 + m;
  const bucketStart = Math.floor(totalMin / widthMinutes) * widthMinutes;
  const bucketEnd = bucketStart + widthMinutes;
  const fmt = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  return `${fmt(bucketStart)}-${fmt(bucketEnd)}`;
}

function bucketStats(groups: Map<string, Trade[]>): TimeBucketStats[] {
  return [...groups.entries()]
    .map(([bucket, bucketTrades]) => ({
      bucket,
      totalTrades: bucketTrades.length,
      profit: round2(sum(bucketTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(bucketTrades)),
      averagePnl: round2(avg(bucketTrades.map((t) => t.pnl))),
    }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

/** 8. Entry Time Analysis — win rate / profit / avg P&L bucketed by time of day. */
export function analyzeEntryTime(trades: Trade[]): TimeBucketStats[] {
  const groups = groupBy(trades, (t) => timeToBucketLabel(t.entryTime));
  return bucketStats(groups);
}
