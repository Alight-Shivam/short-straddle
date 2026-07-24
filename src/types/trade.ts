/**
 * Core data model for the Short Straddle Backtest Analyzer.
 *
 * The uploaded CSV represents a strategy log where every trading day produces
 * one PARENT row (the combined straddle) followed by one or more LEG rows
 * (the individual CE / PE option legs that make up that straddle).
 *
 * Parent rows are identified by a whole-number `Index` (e.g. "1", "2", "42").
 * Leg rows share the same integer prefix with a decimal suffix
 * (e.g. "1.1", "1.2") and carry the option-specific fields (Type, Strike,
 * B/S, Qty, Entry/Exit Price).
 */

export type OptionType = 'CE' | 'PE' | '';
export type Side = 'Sell' | 'Buy' | '';

/** A single row exactly as it appears in the uploaded CSV (post header-mapping). */
export interface RawTradeRow {
  Index: string;
  'Entry Date': string;
  'Entry Time': string;
  'Exit Date': string;
  'Exit Time': string;
  Type: string;
  Strike: string;
  'B/S': string;
  Qty: string;
  'Entry Price': string;
  'Exit Price': string;
  Vix: string;
  'P/L': string;
}

/** One option leg (CE or PE) belonging to a parent straddle trade. */
export interface TradeLeg {
  rowIndex: string; // e.g. "1.1"
  type: Exclude<OptionType, ''>;
  strike: number;
  side: Exclude<Side, ''>;
  qty: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  /** Which of the leg's own timestamps applied (legs can exit earlier than the parent). */
  entryDate: Date | null;
  entryTime: string;
  exitDate: Date | null;
  exitTime: string;
}

/**
 * A fully reconstructed trading-day trade: the parent summary row plus its
 * CE/PE legs, with derived fields used throughout the analysis engine.
 */
export interface Trade {
  id: string; // parent Index, e.g. "42"
  rowNumber: number; // 1-based position in the original file (for stable sorting)
  entryDate: Date;
  entryTime: string; // normalized "HH:mm:ss"
  exitDate: Date;
  exitTime: string;
  vix: number | null;
  /** Parent P/L as stated in the CSV (source of truth for "actual" pnl). */
  pnl: number;
  legs: TradeLeg[];

  // ---- derived fields (computed once during parsing/enrichment) ----
  ce: TradeLeg | null;
  pe: TradeLeg | null;
  entryPremiumTotal: number | null; // CE entryPrice + PE entryPrice
  exitPremiumTotal: number | null; // CE exitPrice + PE exitPrice
  durationMinutes: number;
  dayOfWeek: number; // 0=Sunday .. 6=Saturday
  dayName: string;
  year: number;
  month: number; // 1-12
  monthName: string;
  isWin: boolean;
  isLoss: boolean;
  isScratch: boolean; // pnl === 0
  isEarlyExit: boolean; // exit before the standard session close
}

/** Result of validating one parent trade + its legs. */
export interface ValidationIssue {
  tradeId: string;
  rowNumber: number;
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface ParsedDataset {
  trades: Trade[];
  issues: ValidationIssue[];
  totalRawRows: number;
  skippedRows: number;
}
