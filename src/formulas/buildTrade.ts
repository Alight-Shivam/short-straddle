import type { Trade, TradeLeg } from '../types/trade';

/**
 * Shared "derived fields" step for turning a parent summary + its CE/PE legs
 * into a fully-enriched `Trade`. This is the ONE place that computes things
 * like `isWin`, `durationMinutes`, `dayName`, `entryPremiumTotal`, etc. — both
 * the CSV importer (`parseTrades.ts`) and the Upstox trade-sync importer
 * (`server/src/upstox/tradeSync.ts`) call this so a trade is scored
 * identically no matter which source it came from.
 */

/** Standard NSE cash-market session close used to flag "early" exits. Change here if needed. */
export const SESSION_CLOSE_TIME = '15:15:00';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Returns "HH:mm:ss" (24h) for stable display/bucketing regardless of input format. */
export function formatTime24(d: Date | null): string {
  if (!d) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export interface BuildTradeInput {
  id: string;
  rowNumber: number;
  entryDate: Date;
  exitDate: Date;
  vix: number | null;
  /** Explicit day-level P/L if the source states one (CSV parent row); otherwise pass null to sum the legs. */
  explicitPnl: number | null;
  legs: TradeLeg[];
}

export function buildTrade(input: BuildTradeInput): Trade {
  const { id, rowNumber, entryDate, exitDate, vix, legs } = input;
  const ce = legs.find((l) => l.type === 'CE') ?? null;
  const pe = legs.find((l) => l.type === 'PE') ?? null;
  const legsPnlSum = legs.reduce((s, l) => s + l.pnl, 0);
  const pnl = input.explicitPnl ?? legsPnlSum;

  const durationMs = exitDate.getTime() - entryDate.getTime();
  const durationMinutes = Math.max(0, Math.round(durationMs / 60000));
  const exitTime = formatTime24(exitDate);

  return {
    id,
    rowNumber,
    entryDate,
    entryTime: formatTime24(entryDate),
    exitDate,
    exitTime,
    vix,
    pnl,
    legs,
    ce,
    pe,
    entryPremiumTotal: ce && pe ? ce.entryPrice + pe.entryPrice : null,
    exitPremiumTotal: ce && pe ? ce.exitPrice + pe.exitPrice : null,
    durationMinutes,
    dayOfWeek: entryDate.getDay(),
    dayName: DAY_NAMES[entryDate.getDay()],
    year: entryDate.getFullYear(),
    month: entryDate.getMonth() + 1,
    monthName: MONTH_NAMES[entryDate.getMonth()],
    isWin: pnl > 0,
    isLoss: pnl < 0,
    isScratch: pnl === 0,
    isEarlyExit: exitTime < SESSION_CLOSE_TIME,
  };
}
