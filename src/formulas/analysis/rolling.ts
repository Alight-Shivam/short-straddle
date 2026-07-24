import type { Trade } from '../../types/trade';
import { round2, sortedByEntry, sum, winRate } from '../_shared';

export const ROLLING_WINDOWS_DAYS = [30, 60, 90, 180, 365];

export interface RollingWindowStats {
  windowDays: number;
  fromDate: Date;
  toDate: Date;
  totalTrades: number;
  netProfit: number;
  winRatePct: number;
}

/** 22. Rolling Performance — trailing N-calendar-day windows ending at the latest trade date. */
export function analyzeRollingPerformance(trades: Trade[], windows = ROLLING_WINDOWS_DAYS): RollingWindowStats[] {
  const ordered = sortedByEntry(trades);
  if (ordered.length === 0) return [];
  const latest = ordered[ordered.length - 1].entryDate;

  return windows.map((windowDays) => {
    const from = new Date(latest.getTime() - windowDays * 86_400_000);
    const windowTrades = ordered.filter((t) => t.entryDate.getTime() > from.getTime() && t.entryDate.getTime() <= latest.getTime());
    return {
      windowDays,
      fromDate: from,
      toDate: latest,
      totalTrades: windowTrades.length,
      netProfit: round2(sum(windowTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(windowTrades)),
    };
  });
}
