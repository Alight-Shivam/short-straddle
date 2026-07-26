import { describe, expect, it } from 'vitest';
import { buildTrade } from '../buildTrade';
import { runFullAnalysis } from '../index';
import { answerQuery } from './nlQuery';
import type { Trade } from '../../types/trade';

const STARTING_CAPITAL = 100_000;

function makeTrade(id: string, dateStr: string, pnl: number): Trade {
  const date = new Date(dateStr);
  return buildTrade({ id, rowNumber: Number(id), entryDate: date, exitDate: date, vix: null, explicitPnl: pnl, legs: [] });
}

describe('answerQuery', () => {
  it('reports no trades loaded for an empty report', () => {
    const report = runFullAnalysis([], { startingCapital: STARTING_CAPITAL });
    const result = answerQuery(report, 'what is my win rate');
    expect(result.matched).toBe(false);
    expect(result.answer).toMatch(/no trades/i);
  });

  it('prompts for a question on an empty query string', () => {
    const trades = [makeTrade('1', '2024-01-01', 1000)];
    const report = runFullAnalysis(trades, { startingCapital: STARTING_CAPITAL });
    const result = answerQuery(report, '   ');
    expect(result.matched).toBe(false);
  });

  it('answers a win-rate question from overview stats', () => {
    const trades = [makeTrade('1', '2024-01-01', 1000), makeTrade('2', '2024-01-02', -500)];
    const report = runFullAnalysis(trades, { startingCapital: STARTING_CAPITAL });
    const result = answerQuery(report, 'What is my win rate?');
    expect(result.matched).toBe(true);
    expect(result.intentId).toBe('win-rate');
    expect(result.answer).toContain('50.0%');
  });

  it('answers a net-profit question', () => {
    const trades = [makeTrade('1', '2024-01-01', 1000), makeTrade('2', '2024-01-02', 500)];
    const report = runFullAnalysis(trades, { startingCapital: STARTING_CAPITAL });
    const result = answerQuery(report, 'total profit');
    expect(result.intentId).toBe('net-profit');
    expect(result.answer).toContain('1500');
  });

  it('answers a best-day question by naming the strongest weekday', () => {
    const trades = [
      ...['2024-01-01', '2024-01-08', '2024-01-15'].map((d, i) => makeTrade(`m${i}`, d, 3000)),
      ...['2024-01-05', '2024-01-12', '2024-01-19'].map((d, i) => makeTrade(`f${i}`, d, -1000)),
    ];
    const report = runFullAnalysis(trades, { startingCapital: STARTING_CAPITAL });
    const result = answerQuery(report, 'best day of week');
    expect(result.intentId).toBe('best-day');
    expect(result.answer).toContain('Monday');
  });

  it('falls back with a helpful message for an unrecognized question', () => {
    const trades = [makeTrade('1', '2024-01-01', 1000)];
    const report = runFullAnalysis(trades, { startingCapital: STARTING_CAPITAL });
    const result = answerQuery(report, 'what is the meaning of life');
    expect(result.matched).toBe(false);
    expect(result.answer).toContain('win rate');
  });

  it('matches the first applicable intent when a query could plausibly hit more than one pattern', () => {
    const trades = [makeTrade('1', '2024-01-01', 1000)];
    const report = runFullAnalysis(trades, { startingCapital: STARTING_CAPITAL });
    const result = answerQuery(report, 'sharpe ratio');
    expect(result.intentId).toBe('sharpe');
  });
});
