import type { Trade } from '../../types/trade';
import { avg, round2, sortedByEntry } from '../_shared';

export interface StreakInfo {
  length: number;
  startDate: Date;
  endDate: Date;
  pnl: number;
}

export interface StreaksReport {
  longestWinningStreak: StreakInfo | null;
  longestLosingStreak: StreakInfo | null;
  averageWinStreak: number;
  averageLossStreak: number;
  allWinStreaks: StreakInfo[];
  allLossStreaks: StreakInfo[];
}

/** 20. Consecutive Wins/Losses. Scratch trades (pnl === 0) break a streak without starting a new one. */
export function analyzeStreaks(trades: Trade[]): StreaksReport {
  const ordered = sortedByEntry(trades);
  const winStreaks: StreakInfo[] = [];
  const lossStreaks: StreakInfo[] = [];

  let currentType: 'win' | 'loss' | null = null;
  let currentStart: Trade | null = null;
  let currentPnl = 0;
  let currentLen = 0;
  let last: Trade | null = null;

  const flush = () => {
    if (currentType && currentStart && last && currentLen > 0) {
      const info: StreakInfo = { length: currentLen, startDate: currentStart.entryDate, endDate: last.entryDate, pnl: round2(currentPnl) };
      (currentType === 'win' ? winStreaks : lossStreaks).push(info);
    }
    currentType = null;
    currentStart = null;
    currentPnl = 0;
    currentLen = 0;
  };

  for (const t of ordered) {
    const type: 'win' | 'loss' | null = t.isWin ? 'win' : t.isLoss ? 'loss' : null;
    if (type === null) {
      flush();
      last = t;
      continue;
    }
    if (type === currentType) {
      currentLen += 1;
      currentPnl += t.pnl;
    } else {
      flush();
      currentType = type;
      currentStart = t;
      currentLen = 1;
      currentPnl = t.pnl;
    }
    last = t;
  }
  flush();

  const longestWinningStreak = winStreaks.reduce<StreakInfo | null>((best, s) => (!best || s.length > best.length ? s : best), null);
  const longestLosingStreak = lossStreaks.reduce<StreakInfo | null>((best, s) => (!best || s.length > best.length ? s : best), null);

  return {
    longestWinningStreak,
    longestLosingStreak,
    averageWinStreak: round2(avg(winStreaks.map((s) => s.length))),
    averageLossStreak: round2(avg(lossStreaks.map((s) => s.length))),
    allWinStreaks: winStreaks,
    allLossStreaks: lossStreaks,
  };
}
