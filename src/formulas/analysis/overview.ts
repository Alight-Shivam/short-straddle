import type { Trade } from '../../types/trade';
import { avg, pnlOf, round2, sum, winRate } from '../_shared';
import { analyzeDrawdown } from './drawdown';
import { analyzeStreaks } from './streaks';

export interface OverallPerformance {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  scratchTrades: number;
  winRatePct: number;
  lossRatePct: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number; // negative number
  averageProfit: number; // average of winning trades only
  averageLoss: number; // average of losing trades only (negative)
  largestProfit: number;
  largestLoss: number; // negative number
  profitFactor: number; // grossProfit / abs(grossLoss)
  expectancy: number; // average P/L per trade
  recoveryFactor: number; // netProfit / maxDrawdown
  averageRR: number; // averageProfit / abs(averageLoss)
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
}

/** 1. Overall Performance — the headline KPI block. */
export function computeOverallPerformance(trades: Trade[]): OverallPerformance {
  const pnls = pnlOf(trades);
  const wins = trades.filter((t) => t.isWin);
  const losses = trades.filter((t) => t.isLoss);

  const netProfit = sum(pnls);
  const grossProfit = sum(wins.map((t) => t.pnl));
  const grossLoss = sum(losses.map((t) => t.pnl));
  const averageProfit = avg(wins.map((t) => t.pnl));
  const averageLoss = avg(losses.map((t) => t.pnl));
  const largestProfit = wins.length ? Math.max(...wins.map((t) => t.pnl)) : 0;
  const largestLoss = losses.length ? Math.min(...losses.map((t) => t.pnl)) : 0;

  const { maxDrawdown } = analyzeDrawdown(trades);
  const { longestWinningStreak, longestLosingStreak } = analyzeStreaks(trades);

  return {
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    scratchTrades: trades.filter((t) => t.isScratch).length,
    winRatePct: round2(winRate(trades)),
    lossRatePct: round2(trades.length ? (losses.length / trades.length) * 100 : 0),
    netProfit: round2(netProfit),
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    averageProfit: round2(averageProfit),
    averageLoss: round2(averageLoss),
    largestProfit: round2(largestProfit),
    largestLoss: round2(largestLoss),
    profitFactor: grossLoss !== 0 ? round2(grossProfit / Math.abs(grossLoss)) : grossProfit > 0 ? Infinity : 0,
    expectancy: round2(avg(pnls)),
    recoveryFactor: maxDrawdown !== 0 ? round2(netProfit / maxDrawdown) : netProfit > 0 ? Infinity : 0,
    averageRR: averageLoss !== 0 ? round2(Math.abs(averageProfit / averageLoss)) : 0,
    maxConsecutiveWins: longestWinningStreak?.length ?? 0,
    maxConsecutiveLosses: longestLosingStreak?.length ?? 0,
  };
}
