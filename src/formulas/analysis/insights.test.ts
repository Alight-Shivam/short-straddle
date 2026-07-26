import { describe, expect, it } from 'vitest';
import { buildTrade } from '../buildTrade';
import { runFullAnalysis } from '../index';
import type { Trade } from '../../types/trade';

const STARTING_CAPITAL = 100_000;

function makeTrade(id: string, dateStr: string, pnl: number): Trade {
  const date = new Date(dateStr);
  return buildTrade({ id, rowNumber: Number(id), entryDate: date, exitDate: date, vix: null, explicitPnl: pnl, legs: [] });
}

describe('generateInsights (via runFullAnalysis)', () => {
  it('returns no insights for an empty trade list', () => {
    const report = runFullAnalysis([], { startingCapital: STARTING_CAPITAL });
    expect(report.insights).toEqual([]);
  });

  it('flags overall unprofitability when net P/L is negative', () => {
    const trades = [makeTrade('1', '2024-01-01', -1000), makeTrade('2', '2024-01-08', -2000), makeTrade('3', '2024-01-15', -1500)];
    const report = runFullAnalysis(trades, { startingCapital: STARTING_CAPITAL });
    const profitability = report.insights.find((i) => i.id === 'profitability');
    expect(profitability?.severity).toBe('negative');
  });

  it('flags solid profitability for a consistently profitable, low-loss dataset', () => {
    const trades = Array.from({ length: 10 }, (_, i) => makeTrade(String(i + 1), `2024-0${((i % 9) + 1)}-10`, 2000));
    const report = runFullAnalysis(trades, { startingCapital: STARTING_CAPITAL });
    const profitability = report.insights.find((i) => i.id === 'profitability');
    expect(profitability?.severity).toBe('positive');
  });

  it('surfaces a day-of-week skew when one weekday clearly outperforms another (min 3 trades/bucket)', () => {
    // Mondays (2024-01-01, -08, -15, -22) strongly positive; Fridays (2024-01-05, -12, -19, -26) strongly negative.
    const trades = [
      ...['2024-01-01', '2024-01-08', '2024-01-15', '2024-01-22'].map((d, i) => makeTrade(`m${i}`, d, 3000)),
      ...['2024-01-05', '2024-01-12', '2024-01-19', '2024-01-26'].map((d, i) => makeTrade(`f${i}`, d, -2000)),
    ];
    const report = runFullAnalysis(trades, { startingCapital: STARTING_CAPITAL });
    const dayInsight = report.insights.find((i) => i.id === 'day-of-week');
    expect(dayInsight).toBeDefined();
    expect(dayInsight!.message).toContain('Monday');
    expect(dayInsight!.message).toContain('Friday');
  });

  it('sorts negative/warning insights before positive/neutral ones', () => {
    const trades = [
      makeTrade('1', '2024-01-01', -1000),
      makeTrade('2', '2024-01-08', -1000),
      makeTrade('3', '2024-01-15', -1000),
    ];
    const report = runFullAnalysis(trades, { startingCapital: STARTING_CAPITAL });
    const severities = report.insights.map((i) => i.severity);
    const firstPositiveIdx = severities.indexOf('positive');
    const firstNegativeIdx = severities.indexOf('negative');
    if (firstPositiveIdx !== -1 && firstNegativeIdx !== -1) {
      expect(firstNegativeIdx).toBeLessThan(firstPositiveIdx);
    }
  });

  it('does not flag a losing streak insight for a short streak', () => {
    const trades = [makeTrade('1', '2024-01-01', -100), makeTrade('2', '2024-01-02', 100)];
    const report = runFullAnalysis(trades, { startingCapital: STARTING_CAPITAL });
    expect(report.insights.find((i) => i.id === 'losing-streak')).toBeUndefined();
  });

  it('flags a long losing streak (>=5 in a row)', () => {
    const trades = Array.from({ length: 6 }, (_, i) => makeTrade(String(i + 1), `2024-01-0${i + 1}`, -500));
    const report = runFullAnalysis(trades, { startingCapital: STARTING_CAPITAL });
    const streakInsight = report.insights.find((i) => i.id === 'losing-streak');
    expect(streakInsight?.severity).toBe('warning');
  });
});
