/**
 * "If I sold this straddle right now" payoff — purely a live decision-support
 * view (expiry-day P/L vs spot), independent of the historical backtest
 * engine in `formulas/analysis/*`. This does NOT account for early exit,
 * time decay before expiry, or margin — it's the textbook expiry payoff.
 */
export interface StraddlePayoffInput {
  strike: number;
  ceEntryPrice: number;
  peEntryPrice: number;
  qty: number;
}

export interface StraddlePayoffResult {
  totalPremium: number; // per unit, i.e. ceEntryPrice + peEntryPrice
  maxProfit: number; // totalPremium * qty, realized if spot == strike at expiry
  lowerBreakeven: number;
  upperBreakeven: number;
  /** Payoff in rupees at each sampled spot price — for charting. */
  curve: { spot: number; pnl: number }[];
}

export function computeStraddlePayoff(input: StraddlePayoffInput, spotRangePct = 0.1, points = 41): StraddlePayoffResult {
  const { strike, ceEntryPrice, peEntryPrice, qty } = input;
  const totalPremium = ceEntryPrice + peEntryPrice;
  const lowerBreakeven = strike - totalPremium;
  const upperBreakeven = strike + totalPremium;

  const lo = strike * (1 - spotRangePct);
  const hi = strike * (1 + spotRangePct);
  const step = (hi - lo) / (points - 1);

  const curve = Array.from({ length: points }, (_, i) => {
    const spot = lo + i * step;
    // Short straddle: collect both premiums, pay out intrinsic value on whichever leg finishes ITM.
    const ceIntrinsic = Math.max(0, spot - strike);
    const peIntrinsic = Math.max(0, strike - spot);
    const pnl = (totalPremium - ceIntrinsic - peIntrinsic) * qty;
    return { spot: Math.round(spot * 100) / 100, pnl: Math.round(pnl * 100) / 100 };
  });

  return {
    totalPremium,
    maxProfit: totalPremium * qty,
    lowerBreakeven,
    upperBreakeven,
    curve,
  };
}
