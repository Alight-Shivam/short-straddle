import type { Trade } from '../../types/trade';
import { avg, groupBy, round2, sum, winRate } from '../_shared';

export interface DayStats {
  dayOfWeek: number; // 1=Monday..5=Friday
  dayName: string;
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

const WEEKDAYS = [
  { dayOfWeek: 1, dayName: 'Monday' },
  { dayOfWeek: 2, dayName: 'Tuesday' },
  { dayOfWeek: 3, dayName: 'Wednesday' },
  { dayOfWeek: 4, dayName: 'Thursday' },
  { dayOfWeek: 5, dayName: 'Friday' },
];

/** 6. Day Wise Analysis — Monday through Friday. */
export function analyzeDayWise(trades: Trade[]): DayStats[] {
  const groups = groupBy(trades, (t) => t.dayOfWeek);
  return WEEKDAYS.map(({ dayOfWeek, dayName }) => {
    const dayTrades = groups.get(dayOfWeek) ?? [];
    return {
      dayOfWeek,
      dayName,
      totalTrades: dayTrades.length,
      profit: round2(sum(dayTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(dayTrades)),
      averagePnl: round2(avg(dayTrades.map((t) => t.pnl))),
    };
  });
}
