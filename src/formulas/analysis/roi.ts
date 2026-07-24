import type { Trade } from '../../types/trade';
import { groupBy, round2, sum } from '../_shared';
import { DEFAULT_STARTING_CAPITAL } from './capitalGrowth';

export interface RoiPoint {
  key: string; // "2024-03", "2024-Q1", "2024"
  profit: number;
  roiPct: number;
}

function quarterKey(d: Date): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

/** 25. ROI Analysis — Monthly / Quarterly / Yearly, relative to a starting capital base. */
export function analyzeRoi(trades: Trade[], startingCapital = DEFAULT_STARTING_CAPITAL) {
  const build = (keyFn: (d: Date) => string): RoiPoint[] => {
    const groups = groupBy(trades, (t) => keyFn(t.entryDate));
    return [...groups.entries()]
      .map(([key, g]) => {
        const profit = sum(g.map((t) => t.pnl));
        return { key, profit: round2(profit), roiPct: round2((profit / startingCapital) * 100) };
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  };

  return {
    monthly: build((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`),
    quarterly: build(quarterKey),
    yearly: build((d) => String(d.getFullYear())),
  };
}
