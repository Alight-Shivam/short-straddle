import type { Trade } from '../../types/trade';
import { avg, round2, stdDev, sum } from '../_shared';
import { dailyEquityCurve } from './equityCurve';
import { analyzeDrawdown, buildPercentDrawdownSeries } from './drawdown';
import { DEFAULT_STARTING_CAPITAL } from './capitalGrowth';

/**
 * Risk-adjusted performance metrics — Sharpe, Sortino, Calmar, Ulcer Index —
 * plus MFE/MAE, which are explicitly NOT computable from this app's data yet
 * (see the `mfe`/`mae` fields below). All four ratios are built strictly on
 * top of existing primitives (`dailyEquityCurve`, `analyzeDrawdown`,
 * `buildPercentDrawdownSeries`) rather than re-deriving equity/drawdown math
 * a second time.
 *
 * Daily "returns" are defined as `dailyPnl / startingCapital` — a simple
 * return on the same fixed capital base the rest of the app already uses
 * (`capitalGrowth.ts`), not a compounding return. This keeps every ratio
 * dimensionless (mean/stdev of a %, as Sharpe et al. are conventionally
 * defined) without introducing a second capital model.
 */

/** NSE trading days/year — the standard annualization factor for Indian equity/derivatives. */
export const TRADING_DAYS_PER_YEAR = 252;
const ANNUALIZATION_FACTOR = Math.sqrt(TRADING_DAYS_PER_YEAR);
/** Annual risk-free rate assumption (e.g. 0.07 for 7%). Defaults to 0 — this is a backtest tool, not a bond-relative-return one; change here if you want a non-zero hurdle. */
export const DEFAULT_ANNUAL_RISK_FREE_RATE = 0;
/** Minimum acceptable daily return for the Sortino downside-deviation calc. */
export const MINIMUM_ACCEPTABLE_RETURN = 0;

export interface RiskMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  ulcerIndex: number;
  cagrPct: number;
  /** Always null today — needs intraday price history during the trade's holding window, which no current data source (CSV or Upstox trade-sync) provides. Becomes computable once Phase 1's historical candle store exists to replay against. */
  mfe: null;
  mae: null;
  dataRequirement: 'intraday-price-history';
}

function dailyReturns(trades: Trade[], startingCapital: number): number[] {
  return dailyEquityCurve(trades).map((p) => p.pnl / startingCapital);
}

function downsideDeviation(returns: number[], mar: number): number {
  if (returns.length === 0) return 0;
  const squaredShortfalls = returns.map((r) => Math.min(r - mar, 0) ** 2);
  return Math.sqrt(avg(squaredShortfalls));
}

/** Compound Annual Growth Rate from a starting capital to the actual final capital over the actual date range covered by `trades`. */
function computeCagrPct(trades: Trade[], startingCapital: number): number {
  if (trades.length === 0 || startingCapital <= 0) return 0;
  const ordered = [...trades].sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  const totalPnl = sum(trades.map((t) => t.pnl));
  const finalCapital = startingCapital + totalPnl;
  if (finalCapital <= 0) return -100; // total loss of capital — CAGR isn't meaningfully defined past this point

  const first = ordered[0].entryDate;
  const last = ordered[ordered.length - 1].exitDate;
  const totalDays = Math.max(1, (last.getTime() - first.getTime()) / 86_400_000);
  const years = totalDays / 365;
  // A backtest spanning under a year is too short to responsibly annualize —
  // report the plain total return instead of blowing it up via a fractional exponent.
  if (years < 1) return round2(((finalCapital - startingCapital) / startingCapital) * 100);

  const cagr = (finalCapital / startingCapital) ** (1 / years) - 1;
  return round2(cagr * 100);
}

/** 26. Risk-Adjusted Performance — Sharpe / Sortino / Calmar / Ulcer Index (+ MFE/MAE data-gap marker). */
export function computeRiskMetrics(trades: Trade[], startingCapital = DEFAULT_STARTING_CAPITAL): RiskMetrics {
  const returns = dailyReturns(trades, startingCapital);
  const meanReturn = avg(returns);
  const dailyRiskFreeRate = DEFAULT_ANNUAL_RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;
  const excessReturn = meanReturn - dailyRiskFreeRate;

  const volatility = stdDev(returns);
  const sharpeRatio = volatility > 0 ? round2((excessReturn / volatility) * ANNUALIZATION_FACTOR) : 0;

  const downsideDev = downsideDeviation(returns, MINIMUM_ACCEPTABLE_RETURN);
  const sortinoRatio = downsideDev > 0 ? round2((excessReturn / downsideDev) * ANNUALIZATION_FACTOR) : 0;

  const cagrPct = computeCagrPct(trades, startingCapital);
  const { maxDrawdownPct } = analyzeDrawdown(trades);
  const calmarRatio = maxDrawdownPct > 0 ? round2(cagrPct / maxDrawdownPct) : cagrPct > 0 ? Infinity : 0;

  const pctDrawdownSeries = buildPercentDrawdownSeries(trades, startingCapital);
  const ulcerIndex =
    pctDrawdownSeries.length > 0
      ? round2(Math.sqrt(avg(pctDrawdownSeries.map((p) => p.drawdownPct ** 2))))
      : 0;

  return {
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    ulcerIndex,
    cagrPct,
    mfe: null,
    mae: null,
    dataRequirement: 'intraday-price-history',
  };
}
