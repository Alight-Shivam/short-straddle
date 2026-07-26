import type { Trade } from '../types/trade';
import { computeOverallPerformance, type OverallPerformance } from './analysis/overview';
import { dailyEquityCurve, weeklyEquityCurve, monthlyEquityCurve, yearlyEquityCurve, type EquityPoint } from './analysis/equityCurve';
import { analyzeDrawdown, type DrawdownReport } from './analysis/drawdown';
import { analyzeYearWise, type YearStats } from './analysis/yearWise';
import { analyzeMonthWise, buildMonthlyHeatmap, type MonthStats, type MonthlyHeatmapCell } from './analysis/monthWise';
import { analyzeDayWise, type DayStats } from './analysis/dayWise';
import { analyzeExpiryDay, type ExpiryStats } from './analysis/expiryDay';
import { analyzeEntryTime } from './analysis/entryTime';
import { analyzeExitTime, type ExitTimeReport } from './analysis/exitTime';
import { analyzePremiumRanges, type PremiumRangeStats } from './analysis/premium';
import { analyzeStrike, type StrikeStats } from './analysis/strike';
import { analyzeCePe, type LegSideStats } from './analysis/cePe';
import { analyzePremiumDecay, type DecayBucketStats } from './analysis/premiumDecay';
import { analyzeVolatility, type VixStats } from './analysis/volatility';
import { analyzeGapAndTrend, type GapTrendReport } from './analysis/gapTrend';
import { analyzeExitReason, type ExitReasonStats } from './analysis/exitReason';
import { analyzeDuration, type DurationBucketStats } from './analysis/duration';
import { analyzeDistribution, type DistributionReport } from './analysis/distribution';
import { analyzeStreaks, type StreaksReport } from './analysis/streaks';
import { computeCapitalGrowth, DEFAULT_STARTING_CAPITAL, type CapitalGrowthPoint } from './analysis/capitalGrowth';
import { analyzeRollingPerformance, type RollingWindowStats } from './analysis/rolling';
import { topWinners, topLosers } from './analysis/bestWorst';
import { buildTradeCalendar, type CalendarDay } from './analysis/calendar';
import { analyzeRoi, type RoiPoint } from './analysis/roi';
import type { TimeBucketStats } from './analysis/entryTime';
import { computeRiskMetrics, type RiskMetrics } from './analysis/riskMetrics';

export interface AnalysisReport {
  overview: OverallPerformance;
  riskMetrics: RiskMetrics;
  equityCurve: {
    daily: EquityPoint[];
    weekly: EquityPoint[];
    monthly: EquityPoint[];
    yearly: EquityPoint[];
  };
  drawdown: DrawdownReport;
  yearWise: YearStats[];
  monthWise: MonthStats[];
  monthlyHeatmap: MonthlyHeatmapCell[];
  dayWise: DayStats[];
  expiryDay: ExpiryStats[];
  entryTime: TimeBucketStats[];
  exitTime: ExitTimeReport;
  premiumRanges: PremiumRangeStats[];
  strike: StrikeStats[];
  cePe: { ce: LegSideStats; pe: LegSideStats };
  premiumDecay: DecayBucketStats[];
  volatility: VixStats[];
  gapTrend: GapTrendReport;
  exitReason: ExitReasonStats[];
  duration: DurationBucketStats[];
  distribution: DistributionReport;
  streaks: StreaksReport;
  capitalGrowth: CapitalGrowthPoint[];
  rolling: RollingWindowStats[];
  bestTrades: Trade[];
  worstTrades: Trade[];
  calendar: CalendarDay[];
  roi: { monthly: RoiPoint[]; quarterly: RoiPoint[]; yearly: RoiPoint[] };
}

export interface AnalysisOptions {
  startingCapital?: number;
}

/**
 * Single entry point the UI calls after a dataset is uploaded & validated.
 * Runs every formula module in `formulas/analysis/*` against the (already
 * filtered, if applicable) trade list and returns one aggregate report.
 */
export function runFullAnalysis(trades: Trade[], options: AnalysisOptions = {}): AnalysisReport {
  const startingCapital = options.startingCapital ?? DEFAULT_STARTING_CAPITAL;

  return {
    overview: computeOverallPerformance(trades),
    riskMetrics: computeRiskMetrics(trades, startingCapital),
    equityCurve: {
      daily: dailyEquityCurve(trades),
      weekly: weeklyEquityCurve(trades),
      monthly: monthlyEquityCurve(trades),
      yearly: yearlyEquityCurve(trades),
    },
    drawdown: analyzeDrawdown(trades),
    yearWise: analyzeYearWise(trades, startingCapital),
    monthWise: analyzeMonthWise(trades),
    monthlyHeatmap: buildMonthlyHeatmap(trades),
    dayWise: analyzeDayWise(trades),
    expiryDay: analyzeExpiryDay(trades),
    entryTime: analyzeEntryTime(trades),
    exitTime: analyzeExitTime(trades),
    premiumRanges: analyzePremiumRanges(trades),
    strike: analyzeStrike(trades),
    cePe: analyzeCePe(trades),
    premiumDecay: analyzePremiumDecay(trades),
    volatility: analyzeVolatility(trades),
    gapTrend: analyzeGapAndTrend(trades),
    exitReason: analyzeExitReason(trades),
    duration: analyzeDuration(trades),
    distribution: analyzeDistribution(trades),
    streaks: analyzeStreaks(trades),
    capitalGrowth: computeCapitalGrowth(trades, startingCapital),
    rolling: analyzeRollingPerformance(trades),
    bestTrades: topWinners(trades, 20),
    worstTrades: topLosers(trades, 20),
    calendar: buildTradeCalendar(trades),
    roi: analyzeRoi(trades, startingCapital),
  };
}

export * from './csvSchema';
export * from './parseTrades';
export * from './validation/rules';
