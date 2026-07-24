import type { Trade } from '../../types/trade';
import { avg, round2, sortedByEntry, sum, winRate } from '../_shared';

/**
 * NOTE: The CSV has no underlying spot/OHLC price column. Both Gap and Trend
 * analysis therefore use the day's ATM strike — (CE strike + PE strike) / 2
 * — as a proxy for the underlying's level at entry, since a short straddle
 * is struck at-the-money. This is a reasonable approximation but not exact
 * (strikes move in fixed steps, e.g. 50/100 points, so small moves round
 * away). If you have real OHLC data, swap `spotProxy()` for a real close
 * price and everything downstream keeps working unchanged.
 */
export function spotProxy(t: Trade): number | null {
  if (t.ce && t.pe) return (t.ce.strike + t.pe.strike) / 2;
  if (t.ce) return t.ce.strike;
  if (t.pe) return t.pe.strike;
  return null;
}

/** A move smaller than this (in %) between consecutive trading days is considered a "Flat Open". */
export const GAP_FLAT_THRESHOLD_PCT = 0.3;
/** Number of consecutive same-direction gap days required to call the market "Trending". */
export const TREND_LOOKBACK_DAYS = 3;

export type GapType = 'Gap Up' | 'Gap Down' | 'Flat Open';
export type TrendType = 'Trending' | 'Range' | 'Sideways';

export interface GapStats {
  gapType: GapType;
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

export interface TrendStats {
  trendType: TrendType;
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

export interface GapTrendReport {
  gap: GapStats[];
  trend: TrendStats[];
  /** Breakout / Fake Breakout require intraday high-low data not present in this CSV. */
  insufficientDataNote: string;
}

function classifyGaps(trades: Trade[]): Map<string, GapType> {
  const ordered = sortedByEntry(trades);
  const result = new Map<string, GapType>();
  let prevSpot: number | null = null;
  for (const t of ordered) {
    const spot = spotProxy(t);
    if (spot === null || prevSpot === null) {
      if (spot !== null) prevSpot = spot;
      result.set(t.id, 'Flat Open');
      continue;
    }
    const changePct = ((spot - prevSpot) / prevSpot) * 100;
    if (Math.abs(changePct) < GAP_FLAT_THRESHOLD_PCT) result.set(t.id, 'Flat Open');
    else result.set(t.id, changePct > 0 ? 'Gap Up' : 'Gap Down');
    prevSpot = spot;
  }
  return result;
}

function classifyTrend(gapSeries: GapType[], index: number): TrendType {
  const window = gapSeries.slice(Math.max(0, index - TREND_LOOKBACK_DAYS + 1), index + 1);
  if (window.length < TREND_LOOKBACK_DAYS) return 'Sideways';
  const allUp = window.every((g) => g === 'Gap Up');
  const allDown = window.every((g) => g === 'Gap Down');
  if (allUp || allDown) return 'Trending';
  const allFlat = window.every((g) => g === 'Flat Open');
  return allFlat ? 'Sideways' : 'Range';
}

/**
 * Precomputes gap & trend classification for every trade in one pass. Used
 * both by `analyzeGapAndTrend` and by the dashboard filter bar (which needs
 * a stable per-trade classification computed from the FULL dataset before
 * any filters are applied, since gap/trend depend on the previous day(s)).
 */
export function classifyAllGapTrend(trades: Trade[]): Map<string, { gap: GapType; trend: TrendType }> {
  const ordered = sortedByEntry(trades);
  const gapByTradeId = classifyGaps(ordered);
  const gapSeries = ordered.map((t) => gapByTradeId.get(t.id) ?? 'Flat Open');
  const trendByTradeId = new Map<string, TrendType>();
  ordered.forEach((t, i) => trendByTradeId.set(t.id, classifyTrend(gapSeries, i)));
  const result = new Map<string, { gap: GapType; trend: TrendType }>();
  ordered.forEach((t) => result.set(t.id, { gap: gapByTradeId.get(t.id) ?? 'Flat Open', trend: trendByTradeId.get(t.id) ?? 'Sideways' }));
  return result;
}

/** 15/16. Gap Analysis + Trend Analysis. */
export function analyzeGapAndTrend(trades: Trade[]): GapTrendReport {
  const ordered = sortedByEntry(trades);
  const gapByTradeId = classifyGaps(ordered);
  const gapSeries = ordered.map((t) => gapByTradeId.get(t.id) ?? 'Flat Open');
  const trendByTradeId = new Map<string, TrendType>();
  ordered.forEach((t, i) => trendByTradeId.set(t.id, classifyTrend(gapSeries, i)));

  const gapTypes: GapType[] = ['Gap Up', 'Gap Down', 'Flat Open'];
  const gap = gapTypes.map((gapType) => {
    const bucketTrades = ordered.filter((t) => gapByTradeId.get(t.id) === gapType);
    return {
      gapType,
      totalTrades: bucketTrades.length,
      profit: round2(sum(bucketTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(bucketTrades)),
      averagePnl: round2(avg(bucketTrades.map((t) => t.pnl))),
    };
  });

  const trendTypes: TrendType[] = ['Trending', 'Range', 'Sideways'];
  const trend = trendTypes.map((trendType) => {
    const bucketTrades = ordered.filter((t) => trendByTradeId.get(t.id) === trendType);
    return {
      trendType,
      totalTrades: bucketTrades.length,
      profit: round2(sum(bucketTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(bucketTrades)),
      averagePnl: round2(avg(bucketTrades.map((t) => t.pnl))),
    };
  });

  return {
    gap,
    trend,
    insufficientDataNote:
      'Breakout / Fake Breakout classification needs intraday high-low (OHLC) data, which this CSV format does not include. Add "Day High"/"Day Low" columns and extend formulas/analysis/gapTrend.ts to enable it.',
  };
}
