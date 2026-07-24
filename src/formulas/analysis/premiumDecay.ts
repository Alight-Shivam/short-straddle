import type { Trade } from '../../types/trade';
import { avg, round2, sum, winRate } from '../_shared';

export interface DecayBucketStats {
  bucket: string; // "40%-50%"
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

/**
 * 13. Premium Decay % — classifies each trade by how much of the combined
 * CE+PE entry premium decayed away by exit:
 *   decay% = (entryPremiumTotal - exitPremiumTotal) / entryPremiumTotal * 100
 * A short-straddle seller wants this number as close to 100% as possible.
 * Negative values mean the combined premium expanded (a losing trade).
 */
export function computeDecayPct(t: Trade): number | null {
  if (t.entryPremiumTotal === null || t.exitPremiumTotal === null || t.entryPremiumTotal === 0) return null;
  return ((t.entryPremiumTotal - t.exitPremiumTotal) / t.entryPremiumTotal) * 100;
}

export function analyzePremiumDecay(trades: Trade[]): DecayBucketStats[] {
  const bounds = [-Infinity, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, Infinity];
  const withDecay = trades
    .map((t) => ({ t, decay: computeDecayPct(t) }))
    .filter((x): x is { t: Trade; decay: number } => x.decay !== null);

  const out: DecayBucketStats[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const lo = bounds[i];
    const hi = bounds[i + 1];
    const bucketTrades = withDecay.filter((x) => x.decay >= lo && x.decay < hi).map((x) => x.t);
    const label = lo === -Infinity ? '<0%' : hi === Infinity ? '100%+' : `${lo}%-${hi}%`;
    out.push({
      bucket: label,
      totalTrades: bucketTrades.length,
      profit: round2(sum(bucketTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(bucketTrades)),
      averagePnl: round2(avg(bucketTrades.map((t) => t.pnl))),
    });
  }
  return out;
}
