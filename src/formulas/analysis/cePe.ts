import type { Trade } from '../../types/trade';
import { avg, round2, sum } from '../_shared';

export interface LegSideStats {
  side: 'CE' | 'PE';
  totalEntryPremium: number;
  totalExitPremium: number;
  averageEntryPremium: number;
  averageExitPremium: number;
  totalPnl: number;
  averagePnl: number;
  /** Average decay % achieved: (entry-exit)/entry * 100, positive = good for a seller. */
  averageDecayPct: number;
  winningLegs: number;
  losingLegs: number;
}

function statsFor(legs: { entryPrice: number; exitPrice: number; pnl: number }[], side: 'CE' | 'PE'): LegSideStats {
  const decays = legs.filter((l) => l.entryPrice > 0).map((l) => ((l.entryPrice - l.exitPrice) / l.entryPrice) * 100);
  return {
    side,
    totalEntryPremium: round2(sum(legs.map((l) => l.entryPrice))),
    totalExitPremium: round2(sum(legs.map((l) => l.exitPrice))),
    averageEntryPremium: round2(avg(legs.map((l) => l.entryPrice))),
    averageExitPremium: round2(avg(legs.map((l) => l.exitPrice))),
    totalPnl: round2(sum(legs.map((l) => l.pnl))),
    averagePnl: round2(avg(legs.map((l) => l.pnl))),
    averageDecayPct: round2(avg(decays)),
    winningLegs: legs.filter((l) => l.pnl > 0).length,
    losingLegs: legs.filter((l) => l.pnl < 0).length,
  };
}

/** 12. CE vs PE Analysis — premium contribution & decay per leg type. */
export function analyzeCePe(trades: Trade[]): { ce: LegSideStats; pe: LegSideStats } {
  const ceLegs = trades.map((t) => t.ce).filter((l): l is NonNullable<typeof l> => l !== null);
  const peLegs = trades.map((t) => t.pe).filter((l): l is NonNullable<typeof l> => l !== null);
  return { ce: statsFor(ceLegs, 'CE'), pe: statsFor(peLegs, 'PE') };
}
