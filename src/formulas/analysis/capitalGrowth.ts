import type { Trade } from '../../types/trade';
import { round2, sortedByEntry } from '../_shared';

/**
 * Default starting capital used for ROI% and capital-growth calculations
 * throughout the app. This is the single place to change it; every caller
 * accepts an optional override so the dashboard's "Starting Capital" filter
 * can pass a user-chosen value through.
 */
export const DEFAULT_STARTING_CAPITAL = 100_000;

export interface CapitalGrowthPoint {
  date: Date;
  key: string;
  pnl: number;
  capital: number; // capital after this trade/day
  cumulativeReturnPct: number; // vs starting capital
}

/**
 * 21. Capital Growth — simple (non-compounded reinvestment of capital is not
 * assumed; we track capital = startingCapital + cumulative P/L). This mirrors
 * how a fixed-lot-size options seller typically reports growth, since lot
 * sizes here (`Qty`) are fixed by the trade log rather than resized with
 * capital the way an equity-compounding formula would require.
 */
export function computeCapitalGrowth(trades: Trade[], startingCapital = DEFAULT_STARTING_CAPITAL): CapitalGrowthPoint[] {
  const ordered = sortedByEntry(trades);
  let capital = startingCapital;
  const out: CapitalGrowthPoint[] = [];
  for (const t of ordered) {
    capital += t.pnl;
    out.push({
      date: t.entryDate,
      key: t.id,
      pnl: round2(t.pnl),
      capital: round2(capital),
      cumulativeReturnPct: round2(((capital - startingCapital) / startingCapital) * 100),
    });
  }
  return out;
}

export function currentCapital(trades: Trade[], startingCapital = DEFAULT_STARTING_CAPITAL): number {
  const points = computeCapitalGrowth(trades, startingCapital);
  return points.length ? points[points.length - 1].capital : startingCapital;
}
