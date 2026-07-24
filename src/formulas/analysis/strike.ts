import type { Trade } from '../../types/trade';
import { avg, round2, sum, winRate } from '../_shared';

/**
 * NOTE: In a short straddle, CE and PE are (by construction) sold at the
 * SAME strike, which is chosen at-the-money (ATM) at entry. There is no spot
 * price column in the CSV to independently verify "moneyness", so:
 *  - CE strike === PE strike  -> "ATM" (a true straddle)
 *  - CE strike !== PE strike  -> "OTM (Strangle)" — both legs were sold away
 *    from the money on either side (a strangle rather than a pure straddle)
 * "ITM" cannot occur at entry for a straddle sold ATM, so it only ever
 * appears here if your data legitimately places both legs on the same side
 * of the money — kept as a bucket for completeness / future data.
 */
export type StrikeBucket = 'ATM' | 'ITM' | 'OTM (Strangle)';

export interface StrikeStats {
  bucket: StrikeBucket;
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

export function classifyStrikeBucket(t: Trade): StrikeBucket {
  if (!t.ce || !t.pe) return 'ATM';
  return t.ce.strike === t.pe.strike ? 'ATM' : 'OTM (Strangle)';
}

/** 11. Strike Analysis — ATM / ITM / OTM. */
export function analyzeStrike(trades: Trade[]): StrikeStats[] {
  const buckets: StrikeBucket[] = ['ATM', 'ITM', 'OTM (Strangle)'];
  return buckets.map((bucket) => {
    const bucketTrades = trades.filter((t) => classifyStrikeBucket(t) === bucket);
    return {
      bucket,
      totalTrades: bucketTrades.length,
      profit: round2(sum(bucketTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(bucketTrades)),
      averagePnl: round2(avg(bucketTrades.map((t) => t.pnl))),
    };
  });
}
