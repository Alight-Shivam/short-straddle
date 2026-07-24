import type { Trade } from '../../types/trade';
import { avg, groupBy, round2, sum, winRate } from '../_shared';

export interface MonthStats {
  month: number; // 1-12
  monthName: string;
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

export interface MonthlyHeatmapCell {
  year: number;
  month: number; // 1-12
  monthName: string;
  profit: number;
  totalTrades: number;
  winRatePct: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 5. Month Wise Analysis — aggregated across all years (seasonality view). */
export function analyzeMonthWise(trades: Trade[]): MonthStats[] {
  const groups = groupBy(trades, (t) => t.month);
  return Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
    const monthTrades = groups.get(month) ?? [];
    return {
      month,
      monthName: MONTH_NAMES[month - 1],
      totalTrades: monthTrades.length,
      profit: round2(sum(monthTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(monthTrades)),
      averagePnl: round2(avg(monthTrades.map((t) => t.pnl))),
    };
  });
}

/** 5b. Monthly Heatmap — one cell per (year, month) so the UI can render a calendar-style grid. */
export function buildMonthlyHeatmap(trades: Trade[]): MonthlyHeatmapCell[] {
  const groups = groupBy(trades, (t) => `${t.year}-${t.month}`);
  return [...groups.entries()]
    .map(([key, cellTrades]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        year,
        month,
        monthName: MONTH_NAMES[month - 1],
        profit: round2(sum(cellTrades.map((t) => t.pnl))),
        totalTrades: cellTrades.length,
        winRatePct: round2(winRate(cellTrades)),
      };
    })
    .sort((a, b) => a.year - b.year || a.month - b.month);
}
