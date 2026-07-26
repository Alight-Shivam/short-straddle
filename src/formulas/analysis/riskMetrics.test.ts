import { describe, expect, it } from 'vitest';
import { buildTrade } from '../buildTrade';
import { computeRiskMetrics } from './riskMetrics';
import type { Trade } from '../../types/trade';

const STARTING_CAPITAL = 100_000;

/** Builds a minimal, fully-derived `Trade` via the same `buildTrade()` the CSV/Upstox importers use — no ad-hoc fixture shape to drift from the real one. */
function makeTrade(id: string, dateStr: string, pnl: number): Trade {
  const date = new Date(dateStr);
  return buildTrade({ id, rowNumber: Number(id), entryDate: date, exitDate: date, vix: null, explicitPnl: pnl, legs: [] });
}

describe('computeRiskMetrics', () => {
  it('returns all-zero metrics for an empty trade list, with mfe/mae marked as unavailable', () => {
    const result = computeRiskMetrics([], STARTING_CAPITAL);
    expect(result.sharpeRatio).toBe(0);
    expect(result.sortinoRatio).toBe(0);
    expect(result.calmarRatio).toBe(0);
    expect(result.ulcerIndex).toBe(0);
    expect(result.cagrPct).toBe(0);
    expect(result.mfe).toBeNull();
    expect(result.mae).toBeNull();
    expect(result.dataRequirement).toBe('intraday-price-history');
  });

  it('scores a single losing trade correctly (hand-verified: -5% day, no variance to measure Sharpe against)', () => {
    const trades = [makeTrade('1', '2024-01-01', -5000)];
    const result = computeRiskMetrics(trades, STARTING_CAPITAL);

    // A single data point has no variance (stdDev requires >= 2 points), so Sharpe is 0 by convention, not NaN/Infinity.
    expect(result.sharpeRatio).toBe(0);
    // Sortino's downside deviation IS defined from one negative point: ratio collapses to exactly -1 * sqrt(252).
    expect(result.sortinoRatio).toBeCloseTo(-1 * Math.sqrt(252), 1);
    // A same-day loss with no prior profit peak never registers a % drawdown against the (zero) P&L-curve peak —
    // this mirrors analyzeDrawdown()'s own existing convention, so Calmar has no drawdown to divide by.
    expect(result.calmarRatio).toBe(0);
    // Ulcer Index uses account-capital-based drawdown %, which IS well-defined here: exactly 5% below the starting peak.
    expect(result.ulcerIndex).toBeCloseTo(5, 5);
    // Under a year of data reports the plain total return rather than an annualized (and here, wildly distorted) CAGR.
    expect(result.cagrPct).toBe(-5);
  });

  it('reports Infinity Calmar and zero Sharpe/Sortino/Ulcer for a constant-return, zero-drawdown winning streak', () => {
    const trades = [
      makeTrade('1', '2024-01-01', 1000),
      makeTrade('2', '2024-01-02', 1000),
      makeTrade('3', '2024-01-03', 1000),
    ];
    const result = computeRiskMetrics(trades, STARTING_CAPITAL);

    expect(result.sharpeRatio).toBe(0); // identical daily returns -> zero volatility to reward
    expect(result.sortinoRatio).toBe(0); // no return ever fell below the minimum acceptable return
    expect(result.ulcerIndex).toBe(0); // equity only ever made new highs
    expect(result.calmarRatio).toBe(Infinity); // positive CAGR over a max drawdown of exactly 0%
    expect(result.cagrPct).toBe(3); // (103,000 - 100,000) / 100,000, under a year so reported as total return
  });

  it('produces finite, sane numbers for a mixed win/loss series (no NaN/undefined anywhere)', () => {
    const trades = Array.from({ length: 20 }, (_, i) =>
      makeTrade(String(i + 1), `2024-01-${String((i % 28) + 1).padStart(2, '0')}`, i % 3 === 0 ? -2000 : 1000),
    );
    const result = computeRiskMetrics(trades, STARTING_CAPITAL);

    for (const value of [result.sharpeRatio, result.sortinoRatio, result.ulcerIndex, result.cagrPct]) {
      expect(Number.isNaN(value)).toBe(false);
      expect(value).not.toBeUndefined();
    }
    expect(result.ulcerIndex).toBeGreaterThanOrEqual(0);
    expect(result.mfe).toBeNull();
    expect(result.mae).toBeNull();
  });
});
