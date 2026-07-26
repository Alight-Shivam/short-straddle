import type { OptionChainRow } from '../../types/liveMarket';

export interface MaxPainPoint {
  strike: number;
  totalPain: number; // aggregate rupee payout option WRITERS would owe if underlying expired here
}

export interface MaxPainResult {
  maxPainStrike: number | null;
  curve: MaxPainPoint[];
}

/**
 * Max Pain: the strike at which option WRITERS collectively owe the least
 * (equivalently, option buyers collectively gain the least) if the
 * underlying were to expire exactly there. Theory says price gravitates
 * toward this strike into expiry, since writers dominate open interest —
 * treat it as one input among many, not a prediction (max pain has real
 * predictive value mainly in the last few sessions before expiry, and only
 * when OI is genuinely concentrated).
 *
 * For a candidate expiry price E:
 *   pain(E) = sum over calls, strike K <= E, of (E - K) * callOI(K)     [ITM calls cost writers]
 *           + sum over puts,  strike K >= E, of (K - E) * putOI(K)      [ITM puts cost writers]
 * Max pain strike = argmin over the chain's own strikes of pain(E).
 */
export function computeMaxPain(rows: OptionChainRow[]): MaxPainResult {
  const strikes = rows.map((r) => r.strike_price).sort((a, b) => a - b);
  if (strikes.length === 0) return { maxPainStrike: null, curve: [] };

  const callOiByStrike = new Map(rows.map((r) => [r.strike_price, r.call_options?.market_data.oi ?? 0]));
  const putOiByStrike = new Map(rows.map((r) => [r.strike_price, r.put_options?.market_data.oi ?? 0]));

  const curve: MaxPainPoint[] = strikes.map((expiryCandidate) => {
    let pain = 0;
    for (const k of strikes) {
      if (k <= expiryCandidate) pain += (expiryCandidate - k) * (callOiByStrike.get(k) ?? 0);
      if (k >= expiryCandidate) pain += (k - expiryCandidate) * (putOiByStrike.get(k) ?? 0);
    }
    return { strike: expiryCandidate, totalPain: pain };
  });

  const minPoint = curve.reduce((best, p) => (p.totalPain < best.totalPain ? p : best), curve[0]);
  return { maxPainStrike: minPoint.strike, curve };
}
