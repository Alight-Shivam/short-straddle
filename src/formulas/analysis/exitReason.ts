import type { Trade } from '../../types/trade';
import { avg, round2, sum, winRate } from '../_shared';
import { SESSION_CLOSE_TIME } from '../parseTrades';

/**
 * NOTE: There is no explicit "why did this trade exit" column in the CSV, so
 * the reason is inferred from exit timing patterns actually observed in
 * short-straddle logs of this shape:
 *
 *  - Both legs (and the parent) exit exactly at the session close
 *    (`SESSION_CLOSE_TIME`)                          -> "Time Exit"
 *  - Parent AND every leg exit together, before close -> "SL Hit" if the day
 *    was a loss, "Target Hit" if the day was a profit (the whole position
 *    was closed in one shot ahead of expiry)
 *  - The parent runs to close but one leg exited earlier than the others
 *    (a leg was cut while its partner rode to close)  -> "Manual Exit"
 *    (a discretionary/rules-based single-leg adjustment)
 *
 * This is a heuristic — if you add a real "Exit Reason" column to the CSV in
 * future, replace the body of `classifyExitReason` with a direct read of it.
 */
export type ExitReason = 'SL Hit' | 'Target Hit' | 'Time Exit' | 'Manual Exit';

export interface ExitReasonStats {
  reason: ExitReason;
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

export function classifyExitReason(t: Trade): ExitReason {
  const legExitTimes = t.legs.map((l) => l.exitTime).filter(Boolean);
  const allAtClose = t.exitTime === SESSION_CLOSE_TIME && legExitTimes.every((et) => et === SESSION_CLOSE_TIME || et === '');
  if (allAtClose) return 'Time Exit';

  const someLegEarly = legExitTimes.some((et) => et !== '' && et < t.exitTime);
  const parentEarly = t.exitTime < SESSION_CLOSE_TIME;

  if (parentEarly && !someLegEarly) {
    return t.pnl >= 0 ? 'Target Hit' : 'SL Hit';
  }
  return 'Manual Exit';
}

/** 17. Stoploss / Exit-Reason Analysis. */
export function analyzeExitReason(trades: Trade[]): ExitReasonStats[] {
  const reasons: ExitReason[] = ['SL Hit', 'Target Hit', 'Time Exit', 'Manual Exit'];
  return reasons.map((reason) => {
    const bucketTrades = trades.filter((t) => classifyExitReason(t) === reason);
    return {
      reason,
      totalTrades: bucketTrades.length,
      profit: round2(sum(bucketTrades.map((t) => t.pnl))),
      winRatePct: round2(winRate(bucketTrades)),
      averagePnl: round2(avg(bucketTrades.map((t) => t.pnl))),
    };
  });
}
