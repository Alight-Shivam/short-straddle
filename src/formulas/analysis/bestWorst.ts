import type { Trade } from '../../types/trade';

/** 23. Best & Worst Trades. */
export function topWinners(trades: Trade[], n = 20): Trade[] {
  return [...trades].sort((a, b) => b.pnl - a.pnl).slice(0, n);
}

export function topLosers(trades: Trade[], n = 20): Trade[] {
  return [...trades].sort((a, b) => a.pnl - b.pnl).slice(0, n);
}
