import type { Trade } from '../../types/trade';
import { avg, round2 } from '../_shared';
import { dailyEquityCurve, type EquityPoint } from './equityCurve';

export interface DrawdownEpisode {
  startDate: Date; // date of the prior equity peak
  troughDate: Date; // date drawdown was deepest
  recoveryDate: Date | null; // date equity made a new high again (null if still in drawdown)
  depth: number; // rupee amount below peak at the trough (positive number)
  durationDays: number; // startDate -> recoveryDate (or -> last data point if unrecovered)
}

export interface DrawdownSeriesPoint {
  key: string;
  date: Date;
  equity: number;
  peak: number;
  drawdown: number; // positive number = amount below peak
}

export interface DrawdownReport {
  series: DrawdownSeriesPoint[];
  episodes: DrawdownEpisode[];
  maxDrawdown: number;
  maxDrawdownPct: number; // relative to the peak equity it fell from
  averageDrawdown: number;
  longestDrawdownDays: number;
  averageRecoveryDays: number;
  drawdownFrequency: number; // number of distinct drawdown episodes
}

function buildSeries(points: EquityPoint[]): DrawdownSeriesPoint[] {
  let peak = 0;
  const series: DrawdownSeriesPoint[] = [];
  for (const p of points) {
    peak = Math.max(peak, p.cumulativePnl);
    series.push({ key: p.key, date: p.date, equity: p.cumulativePnl, peak, drawdown: round2(peak - p.cumulativePnl) });
  }
  return series;
}

export interface PercentDrawdownPoint {
  key: string;
  date: Date;
  capital: number;
  peak: number;
  drawdownPct: number; // positive number = % below peak capital
}

/**
 * Same peak-tracking idea as `buildSeries()` above, but expressed as a % of
 * account capital (`startingCapital + cumulativePnl`) rather than a raw
 * rupee amount off a P&L-only curve that can start at/near zero. Needed by
 * `riskMetrics.ts`'s Ulcer Index, which is conventionally computed against
 * account value so the peak is never zero (avoiding a divide-by-zero on the
 * first loss of a fresh account) — kept here rather than duplicated since
 * it's the same underlying daily series `analyzeDrawdown()` already builds.
 */
export function buildPercentDrawdownSeries(trades: Trade[], startingCapital: number): PercentDrawdownPoint[] {
  const equity = dailyEquityCurve(trades);
  let peak = startingCapital;
  return equity.map((p) => {
    const capital = startingCapital + p.cumulativePnl;
    peak = Math.max(peak, capital);
    return {
      key: p.key,
      date: p.date,
      capital: round2(capital),
      peak: round2(peak),
      drawdownPct: peak > 0 ? round2(((peak - capital) / peak) * 100) : 0,
    };
  });
}

/** 3. Drawdown Analysis — computed from the daily equity curve. */
export function analyzeDrawdown(trades: Trade[]): DrawdownReport {
  const equity = dailyEquityCurve(trades);
  const series = buildSeries(equity);

  const episodes: DrawdownEpisode[] = [];
  let inDrawdown = false;
  let episodeStart: DrawdownSeriesPoint | null = null;
  let troughPoint: DrawdownSeriesPoint | null = null;

  for (const point of series) {
    if (point.drawdown > 0) {
      if (!inDrawdown) {
        inDrawdown = true;
        episodeStart = point;
        troughPoint = point;
      } else if (troughPoint && point.drawdown > troughPoint.drawdown) {
        troughPoint = point;
      }
    } else if (inDrawdown && episodeStart && troughPoint) {
      episodes.push({
        startDate: episodeStart.date,
        troughDate: troughPoint.date,
        recoveryDate: point.date,
        depth: troughPoint.drawdown,
        durationDays: Math.max(1, Math.round((point.date.getTime() - episodeStart.date.getTime()) / 86_400_000)),
      });
      inDrawdown = false;
      episodeStart = null;
      troughPoint = null;
    }
  }
  // Unresolved drawdown still running at the end of the data.
  if (inDrawdown && episodeStart && troughPoint) {
    const last = series[series.length - 1];
    episodes.push({
      startDate: episodeStart.date,
      troughDate: troughPoint.date,
      recoveryDate: null,
      depth: troughPoint.drawdown,
      durationDays: Math.max(1, Math.round((last.date.getTime() - episodeStart.date.getTime()) / 86_400_000)),
    });
  }

  const maxDrawdown = episodes.length ? Math.max(...episodes.map((e) => e.depth)) : 0;
  const peakBeforeMaxDd = (() => {
    const worst = episodes.find((e) => e.depth === maxDrawdown);
    if (!worst) return 0;
    const peakPoint = series.find((s) => s.date.getTime() === worst.startDate.getTime());
    return peakPoint?.peak ?? 0;
  })();

  return {
    series,
    episodes,
    maxDrawdown: round2(maxDrawdown),
    maxDrawdownPct: peakBeforeMaxDd > 0 ? round2((maxDrawdown / peakBeforeMaxDd) * 100) : 0,
    averageDrawdown: round2(avg(episodes.map((e) => e.depth))),
    longestDrawdownDays: episodes.length ? Math.max(...episodes.map((e) => e.durationDays)) : 0,
    averageRecoveryDays: round2(avg(episodes.filter((e) => e.recoveryDate).map((e) => e.durationDays))),
    drawdownFrequency: episodes.length,
  };
}
