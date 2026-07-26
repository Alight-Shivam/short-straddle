import { describe, expect, it } from 'vitest';
import { buildTrade } from '../buildTrade';
import { analyzeDrawdown, buildPercentDrawdownSeries } from './drawdown';
import type { Trade } from '../../types/trade';

const STARTING_CAPITAL = 100_000;

function makeTrade(id: string, dateStr: string, pnl: number): Trade {
  const date = new Date(dateStr);
  return buildTrade({ id, rowNumber: Number(id), entryDate: date, exitDate: date, vix: null, explicitPnl: pnl, legs: [] });
}

describe('analyzeDrawdown (existing engine — read-only, verifying current behavior)', () => {
  it('reports no episodes for an empty or monotonically-increasing equity curve', () => {
    expect(analyzeDrawdown([]).drawdownFrequency).toBe(0);

    const risingOnly = [
      makeTrade('1', '2024-01-01', 1000),
      makeTrade('2', '2024-01-02', 1000),
      makeTrade('3', '2024-01-03', 1000),
    ];
    const report = analyzeDrawdown(risingOnly);
    expect(report.drawdownFrequency).toBe(0);
    expect(report.maxDrawdown).toBe(0);
  });

  it('detects and fully recovers a single drawdown episode', () => {
    const trades = [
      makeTrade('1', '2024-01-01', 1000), // cumulative: 1000 (new peak)
      makeTrade('2', '2024-01-02', -1500), // cumulative: -500 (1500 below peak)
      makeTrade('3', '2024-01-03', 1000), // cumulative: 500 (still below peak)
      makeTrade('4', '2024-01-04', 1000), // cumulative: 1500 (new peak — recovered)
    ];
    const report = analyzeDrawdown(trades);

    expect(report.drawdownFrequency).toBe(1);
    expect(report.maxDrawdown).toBe(1500);
    expect(report.episodes[0].recoveryDate).not.toBeNull();
  });
});

describe('buildPercentDrawdownSeries (new, additive export)', () => {
  it('measures drawdown % against account capital, so the peak is never zero even on day one', () => {
    const trades = [
      makeTrade('1', '2024-01-01', 1000), // capital 101,000 (new peak)
      makeTrade('2', '2024-01-02', -1500), // capital 99,500 — 1,485...% below the 101,000 peak
      makeTrade('3', '2024-01-03', 1000), // capital 100,500 — partially recovered
      makeTrade('4', '2024-01-04', 1000), // capital 101,500 (new peak)
    ];
    const series = buildPercentDrawdownSeries(trades, STARTING_CAPITAL);

    expect(series).toHaveLength(4);
    expect(series[0].drawdownPct).toBe(0);
    expect(series[1].drawdownPct).toBeCloseTo(((101_000 - 99_500) / 101_000) * 100, 2);
    expect(series[3].drawdownPct).toBe(0);
    expect(series[3].peak).toBe(101_500);
  });

  it('never divides by a zero peak, unlike the rupee-based series, because it seeds the peak at startingCapital', () => {
    const singleLoss = [makeTrade('1', '2024-01-01', -5000)];
    const series = buildPercentDrawdownSeries(singleLoss, STARTING_CAPITAL);
    expect(series[0].peak).toBe(STARTING_CAPITAL);
    expect(series[0].drawdownPct).toBe(5);
  });
});
