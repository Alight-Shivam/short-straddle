import type { Trade } from '../../types/trade';
import { avg, round2, sum, winRate } from '../_shared';

/** India VIX thresholds separating Low/Medium/High regimes. Edit here to re-tune. */
export const VIX_LOW_MAX = 15;
export const VIX_MEDIUM_MAX = 25;

export type VixBucket = 'Low VIX' | 'Medium VIX' | 'High VIX';

export interface VixStats {
  bucket: VixBucket;
  range: string;
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

export function classifyVix(vix: number | null): VixBucket | null {
  if (vix === null) return null;
  if (vix < VIX_LOW_MAX) return 'Low VIX';
  if (vix < VIX_MEDIUM_MAX) return 'Medium VIX';
  return 'High VIX';
}

/** 14. Volatility Analysis — Low / Medium / High VIX regimes. */
export function analyzeVolatility(trades: Trade[]): VixStats[] {
  const defs: { bucket: VixBucket; range: string }[] = [
    { bucket: 'Low VIX', range: `< ${VIX_LOW_MAX}` },
    { bucket: 'Medium VIX', range: `${VIX_LOW_MAX} - ${VIX_MEDIUM_MAX}` },
    { bucket: 'High VIX', range: `> ${VIX_MEDIUM_MAX}` },
  ];
  return defs.map(({ bucket, range }) => {
    const bucketTrades = trades.filter((t) => classifyVix(t.vix) === bucket);
    return {
      bucket,
      range,
      totalTrades: bucketTrades.length,
      profit: round2(sum(bucketTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(bucketTrades)),
      averagePnl: round2(avg(bucketTrades.map((t) => t.pnl))),
    };
  });
}
