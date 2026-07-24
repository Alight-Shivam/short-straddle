import type { Trade } from '../../types/trade';
import { avg, groupBy, round2, sum, winRate } from '../_shared';
import { analyzeDrawdown } from './drawdown';
import { DEFAULT_STARTING_CAPITAL } from './capitalGrowth';

export interface YearStats {
  year: number;
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averageProfit: number;
  averageLoss: number;
  maxDrawdown: number;
  roiPct: number;
}

/** 4. Year Wise Analysis. */
export function analyzeYearWise(trades: Trade[], startingCapital = DEFAULT_STARTING_CAPITAL): YearStats[] {
  const groups = groupBy(trades, (t) => t.year);
  const years = [...groups.keys()].sort((a, b) => a - b);
  return years.map((year) => {
    const yearTrades = groups.get(year)!;
    const wins = yearTrades.filter((t) => t.isWin);
    const losses = yearTrades.filter((t) => t.isLoss);
    const profit = sum(yearTrades.map((t) => t.pnl));
    return {
      year,
      totalTrades: yearTrades.length,
      profit: round2(profit),
      winRatePct: round2(winRate(yearTrades)),
      averageProfit: round2(avg(wins.map((t) => t.pnl))),
      averageLoss: round2(avg(losses.map((t) => t.pnl))),
      maxDrawdown: analyzeDrawdown(yearTrades).maxDrawdown,
      roiPct: round2((profit / startingCapital) * 100),
    };
  });
}
