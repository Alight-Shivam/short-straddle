import type { Trade } from '../../types/trade';
import { groupBy, round2, sum, toDateKey } from '../_shared';

export interface CalendarDay {
  dateKey: string; // YYYY-MM-DD
  date: Date;
  pnl: number;
  tradeCount: number;
  isWin: boolean;
  isLoss: boolean;
}

/** 24. Trade Calendar — one cell per trading day for a GitHub-style / month-grid heatmap. */
export function buildTradeCalendar(trades: Trade[]): CalendarDay[] {
  const groups = groupBy(trades, (t) => toDateKey(t.entryDate));
  return [...groups.entries()]
    .map(([dateKey, dayTrades]) => {
      const pnl = round2(sum(dayTrades.map((t) => t.pnl)));
      return {
        dateKey,
        date: dayTrades[0].entryDate,
        pnl,
        tradeCount: dayTrades.length,
        isWin: pnl > 0,
        isLoss: pnl < 0,
      };
    })
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}
