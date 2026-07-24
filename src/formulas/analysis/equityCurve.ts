import type { Trade } from '../../types/trade';
import { round2, sortedByEntry, toDateKey, toMonthKey, toWeekKey } from '../_shared';

export interface EquityPoint {
  key: string; // date/week/month/year label
  date: Date; // representative date (first trade date in the bucket) for charting
  pnl: number; // P/L for this bucket
  cumulativePnl: number; // running equity after this bucket
  tradeCount: number;
}

function buildCurve(trades: Trade[], keyFn: (d: Date) => string): EquityPoint[] {
  const ordered = sortedByEntry(trades);
  const buckets = new Map<string, { date: Date; pnl: number; count: number }>();
  for (const t of ordered) {
    const key = keyFn(t.entryDate);
    const existing = buckets.get(key);
    if (existing) {
      existing.pnl += t.pnl;
      existing.count += 1;
    } else {
      buckets.set(key, { date: t.entryDate, pnl: t.pnl, count: 1 });
    }
  }
  let cumulative = 0;
  const points: EquityPoint[] = [];
  for (const [key, b] of buckets) {
    cumulative += b.pnl;
    points.push({ key, date: b.date, pnl: round2(b.pnl), cumulativePnl: round2(cumulative), tradeCount: b.count });
  }
  return points;
}

/** 2. Equity Curve — daily / weekly / monthly / yearly cumulative P/L. */
export const dailyEquityCurve = (trades: Trade[]): EquityPoint[] => buildCurve(trades, toDateKey);
export const weeklyEquityCurve = (trades: Trade[]): EquityPoint[] => buildCurve(trades, toWeekKey);
export const monthlyEquityCurve = (trades: Trade[]): EquityPoint[] => buildCurve(trades, toMonthKey);
export const yearlyEquityCurve = (trades: Trade[]): EquityPoint[] => buildCurve(trades, (d) => String(d.getFullYear()));
