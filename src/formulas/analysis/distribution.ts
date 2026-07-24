import type { Trade } from '../../types/trade';
import { avg, pnlOf, round2, stdDev } from '../_shared';

export interface HistogramBin {
  rangeLabel: string;
  rangeStart: number;
  rangeEnd: number;
  count: number;
}

export interface DistributionReport {
  histogram: HistogramBin[]; // full P/L distribution
  profitHistogram: HistogramBin[]; // winning trades only
  lossHistogram: HistogramBin[]; // losing trades only
  mean: number;
  stdDev: number;
  /** For overlaying a theoretical normal curve: y = normalPdf(x, mean, stdDev). */
  normalPdf: (x: number) => number;
}

function buildHistogram(values: number[], binCount = 12): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = span / binCount;
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    rangeStart: round2(min + i * width),
    rangeEnd: round2(min + (i + 1) * width),
    rangeLabel: `${round2(min + i * width)} to ${round2(min + (i + 1) * width)}`,
    count: 0,
  }));
  for (const v of values) {
    const i = Math.min(binCount - 1, Math.floor((v - min) / width));
    bins[i].count += 1;
  }
  return bins;
}

/** 19. Distribution Analysis — histogram + profit/loss distributions + normal-curve params. */
export function analyzeDistribution(trades: Trade[]): DistributionReport {
  const pnls = pnlOf(trades);
  const mean = avg(pnls);
  const sd = stdDev(pnls);
  return {
    histogram: buildHistogram(pnls),
    profitHistogram: buildHistogram(pnls.filter((p) => p > 0)),
    lossHistogram: buildHistogram(pnls.filter((p) => p < 0)),
    mean: round2(mean),
    stdDev: round2(sd),
    normalPdf: (x: number) => {
      if (sd === 0) return 0;
      return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-((x - mean) ** 2) / (2 * sd * sd));
    },
  };
}
