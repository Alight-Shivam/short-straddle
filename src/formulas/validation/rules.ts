import type { ParsedDataset, RawTradeRow, Trade, ValidationIssue } from '../../types/trade';

/**
 * Stage 1 — Data Validation.
 *
 * Structural problems (bad dates, unknown Type, orphan legs) are already
 * collected in `ParsedDataset.issues` by `parseTrades.ts`. This module adds
 * the business-rule checks from the spec and rolls everything into one
 * `ValidationReport` the UI renders as a single checklist.
 *
 * Tunable thresholds are declared as constants right below so they are easy
 * to find and change without hunting through logic.
 */

/**
 * Trading session bounds used by "Wrong Entry/Exit Time". NSE cash/derivatives
 * normal market hours are 09:15-15:30 IST — unchanged since exchange
 * inception, verified July 2026.
 */
export const MARKET_OPEN_TIME = '09:15:00';
export const MARKET_CLOSE_TIME = '15:30:00';
/**
 * Standard NIFTY strike spacing used by "Wrong Strike", widened to cover
 * every regime confirmed via NSE circulars (July 2026 check):
 *  - 50 pts: the long-standing default for near-the-money weekly strikes
 *  - 100 pts: used for further OTM/ITM strikes and historically for
 *    monthly/quarterly contracts, also BANKNIFTY's standard spacing
 *  - 25 pts: NSE narrowed monthly/quarterly NIFTY strikes to a 25-point
 *    interval (100-1-100 scheme) effective 2025-11-17
 * A leg strike failing all three is still almost certainly a data-entry
 * error, but don't add a 4th value without checking the latest NSE circular
 * first — the list is deliberately an allow-list, not a guess.
 */
export const STRIKE_STEP_CANDIDATES = [25, 50, 100];
/** A straddle's CE/PE strikes further apart than this are flagged (points). */
export const MAX_STRADDLE_STRIKE_GAP = 500;
/** Holding periods longer than this are flagged as a likely expiry mismatch for weekly options. */
export const MAX_HOLDING_DAYS_BEFORE_EXPIRY_FLAG = 8;
/** Absolute rupee tolerance when comparing computed vs stated P/L. */
export const PNL_TOLERANCE = 1.5;
/** Relative tolerance (5%) applied on top of the absolute tolerance for larger P/L values. */
export const PNL_RELATIVE_TOLERANCE = 0.02;
/** CE/PE entry-premium ratio beyond which we flag an "imbalance" warning. */
export const PREMIUM_IMBALANCE_RATIO = 5;

export interface ValidationSummaryItem {
  key: string;
  label: string;
  count: number;
  severity: 'error' | 'warning' | 'info';
  codes: string[];
}

export interface ValidationReport {
  totalTrades: number;
  totalRawRows: number;
  skippedRows: number;
  issues: ValidationIssue[];
  summary: ValidationSummaryItem[];
  isClean: boolean;
}

function within(actual: number, expected: number, tol: number, relTol: number): boolean {
  const tolerance = Math.max(tol, Math.abs(expected) * relTol);
  return Math.abs(actual - expected) <= tolerance;
}

function pushIf(issues: ValidationIssue[], cond: boolean, issue: ValidationIssue) {
  if (cond) issues.push(issue);
}

/**
 * All the per-trade business-rule checks (Entry<Exit, time bounds, expiry
 * proxy, premium sanity, P&L correctness, strike sanity) — these only need a
 * `Trade[]`, so they run identically whether the trades came from a CSV
 * upload or an Upstox sync. Raw-CSV-only checks (Missing Values, which needs
 * the original blank/non-blank string) live in `runValidation` below instead.
 */
export function validateTrades(trades: Trade[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // ---- Duplicate Trades (same parent Index appears more than once) ----
  const idCounts = new Map<string, number>();
  for (const t of trades) idCounts.set(t.id, (idCounts.get(t.id) ?? 0) + 1);
  for (const [id, count] of idCounts) {
    pushIf(issues, count > 1, {
      tradeId: id, rowNumber: -1, severity: 'error', code: 'DUPLICATE_TRADE',
      message: `Index "${id}" appears ${count} times.`,
    });
  }
  // Duplicate on (entryDate + entryTime) is also a strong signal of a re-logged trade.
  const dtCounts = new Map<string, string[]>();
  for (const t of trades) {
    const key = `${t.entryDate.toDateString()}|${t.entryTime}`;
    dtCounts.set(key, [...(dtCounts.get(key) ?? []), t.id]);
  }
  for (const [key, ids] of dtCounts) {
    pushIf(issues, ids.length > 1, {
      tradeId: ids.join(', '), rowNumber: -1, severity: 'warning', code: 'DUPLICATE_ENTRY_TIMESTAMP',
      message: `Trades ${ids.join(', ')} share the same entry date/time (${key.replace('|', ' ')}).`,
    });
  }

  for (const t of trades) {
    // ---- Entry < Exit (chronological sanity) ----
    pushIf(issues, t.entryDate.getTime() >= t.exitDate.getTime(), {
      tradeId: t.id, rowNumber: t.rowNumber, severity: 'error', code: 'ENTRY_NOT_BEFORE_EXIT',
      message: `Trade ${t.id}: entry (${t.entryDate.toISOString()}) is not before exit (${t.exitDate.toISOString()}).`,
    });

    // ---- Wrong Entry / Exit Time (outside session hours) ----
    pushIf(issues, t.entryTime < MARKET_OPEN_TIME || t.entryTime > MARKET_CLOSE_TIME, {
      tradeId: t.id, rowNumber: t.rowNumber, severity: 'warning', code: 'WRONG_ENTRY_TIME',
      message: `Trade ${t.id}: entry time ${t.entryTime} is outside market hours (${MARKET_OPEN_TIME}-${MARKET_CLOSE_TIME}).`,
    });
    pushIf(issues, t.exitTime < MARKET_OPEN_TIME || t.exitTime > MARKET_CLOSE_TIME, {
      tradeId: t.id, rowNumber: t.rowNumber, severity: 'warning', code: 'WRONG_EXIT_TIME',
      message: `Trade ${t.id}: exit time ${t.exitTime} is outside market hours (${MARKET_OPEN_TIME}-${MARKET_CLOSE_TIME}).`,
    });

    // ---- Wrong Expiry (proxy: holding period too long for a weekly option) ----
    const holdingDays = (t.exitDate.getTime() - t.entryDate.getTime()) / 86_400_000;
    pushIf(issues, holdingDays > MAX_HOLDING_DAYS_BEFORE_EXPIRY_FLAG, {
      tradeId: t.id, rowNumber: t.rowNumber, severity: 'warning', code: 'WRONG_EXPIRY',
      message: `Trade ${t.id}: held for ${holdingDays.toFixed(1)} days — likely crosses into the next weekly expiry.`,
    });

    // ---- CE + PE Total Premium sanity ----
    if (t.ce && t.pe) {
      pushIf(issues, (t.entryPremiumTotal ?? 0) <= 0, {
        tradeId: t.id, rowNumber: t.rowNumber, severity: 'error', code: 'BAD_TOTAL_PREMIUM',
        message: `Trade ${t.id}: combined CE+PE entry premium is ${t.entryPremiumTotal}.`,
      });
      const hi = Math.max(t.ce.entryPrice, t.pe.entryPrice);
      const lo = Math.max(0.01, Math.min(t.ce.entryPrice, t.pe.entryPrice));
      pushIf(issues, hi / lo > PREMIUM_IMBALANCE_RATIO, {
        tradeId: t.id, rowNumber: t.rowNumber, severity: 'warning', code: 'PREMIUM_IMBALANCE',
        message: `Trade ${t.id}: CE (${t.ce.entryPrice}) / PE (${t.pe.entryPrice}) entry premiums are heavily skewed.`,
      });
    }

    // ---- Incorrect P&L: parent = sum of legs ----
    if (t.legs.length > 0) {
      const legSum = t.legs.reduce((s, l) => s + l.pnl, 0);
      pushIf(issues, !within(t.pnl, legSum, PNL_TOLERANCE, PNL_RELATIVE_TOLERANCE), {
        tradeId: t.id, rowNumber: t.rowNumber, severity: 'error', code: 'INCORRECT_PNL_PARENT',
        message: `Trade ${t.id}: stated P/L ${t.pnl} does not match sum of leg P/Ls ${legSum.toFixed(2)}.`,
      });
    }

    for (const leg of t.legs) {
      // ---- Negative Price ----
      pushIf(issues, leg.entryPrice < 0 || leg.exitPrice < 0 || leg.strike < 0, {
        tradeId: t.id, rowNumber: t.rowNumber, severity: 'error', code: 'NEGATIVE_PRICE',
        message: `Trade ${t.id} (${leg.type}): negative price/strike detected (entry ${leg.entryPrice}, exit ${leg.exitPrice}, strike ${leg.strike}).`,
      });

      // ---- Wrong Strike ----
      const isValidStep = leg.strike > 0 && STRIKE_STEP_CANDIDATES.some((step) => leg.strike % step === 0);
      pushIf(issues, !isValidStep, {
        tradeId: t.id, rowNumber: t.rowNumber, severity: 'warning', code: 'WRONG_STRIKE',
        message: `Trade ${t.id} (${leg.type}): strike ${leg.strike} isn't a multiple of a standard step (50/100).`,
      });

      // ---- Incorrect P&L: leg-level, based on Sell/Buy formula ----
      const expected = leg.side === 'Sell'
        ? (leg.entryPrice - leg.exitPrice) * leg.qty
        : (leg.exitPrice - leg.entryPrice) * leg.qty;
      pushIf(issues, !within(leg.pnl, expected, PNL_TOLERANCE, PNL_RELATIVE_TOLERANCE), {
        tradeId: t.id, rowNumber: t.rowNumber, severity: 'error', code: 'INCORRECT_PNL_LEG',
        message: `Trade ${t.id} (${leg.type}): stated P/L ${leg.pnl} != expected ${expected.toFixed(2)} for a ${leg.side} at qty ${leg.qty}.`,
      });
    }

    if (t.ce && t.pe) {
      pushIf(issues, t.ce.strike !== t.pe.strike && Math.abs(t.ce.strike - t.pe.strike) > MAX_STRADDLE_STRIKE_GAP, {
        tradeId: t.id, rowNumber: t.rowNumber, severity: 'warning', code: 'STRIKE_GAP',
        message: `Trade ${t.id}: CE strike ${t.ce.strike} and PE strike ${t.pe.strike} are more than ${MAX_STRADDLE_STRIKE_GAP} points apart.`,
      });
    }
  }

  return issues;
}

const SUMMARY_DEFS: { key: string; label: string; codes: string[]; severity: ValidationSummaryItem['severity'] }[] = [
  { key: 'duplicate', label: 'Duplicate Trades', codes: ['DUPLICATE_TRADE', 'DUPLICATE_ENTRY_TIMESTAMP'], severity: 'error' },
  { key: 'missing', label: 'Missing Values', codes: ['MISSING_VALUE'], severity: 'error' },
  { key: 'wrongEntryTime', label: 'Wrong Entry Time', codes: ['WRONG_ENTRY_TIME'], severity: 'warning' },
  { key: 'wrongExitTime', label: 'Wrong Exit Time', codes: ['WRONG_EXIT_TIME'], severity: 'warning' },
  { key: 'wrongStrike', label: 'Wrong Strike', codes: ['WRONG_STRIKE', 'STRIKE_GAP'], severity: 'warning' },
  { key: 'wrongExpiry', label: 'Wrong Expiry', codes: ['WRONG_EXPIRY'], severity: 'warning' },
  { key: 'negativePrice', label: 'Negative Price', codes: ['NEGATIVE_PRICE'], severity: 'error' },
  { key: 'incorrectPnl', label: 'Incorrect P&L', codes: ['INCORRECT_PNL_PARENT', 'INCORRECT_PNL_LEG'], severity: 'error' },
  { key: 'totalPremium', label: 'CE + PE Total Premium Issues', codes: ['BAD_TOTAL_PREMIUM', 'PREMIUM_IMBALANCE'], severity: 'warning' },
  { key: 'entryExit', label: 'Entry Not Before Exit', codes: ['ENTRY_NOT_BEFORE_EXIT'], severity: 'error' },
  { key: 'structural', label: 'Structural (bad date/type/orphan rows)', codes: ['BAD_DATE', 'WRONG_TYPE', 'ORPHAN_LEG'], severity: 'error' },
  { key: 'upstoxSkipped', label: 'Upstox Sync Notes', codes: ['UPSTOX_SYNC_SKIPPED'], severity: 'warning' },
];

function buildReport(trades: Trade[], issues: ValidationIssue[], totalRawRows: number, skippedRows: number): ValidationReport {
  const summary: ValidationSummaryItem[] = SUMMARY_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    severity: def.severity,
    codes: def.codes,
    count: issues.filter((i) => def.codes.includes(i.code)).length,
  }));
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  return { totalTrades: trades.length, totalRawRows, skippedRows, issues, summary, isClean: errorCount === 0 };
}

/** Stage 1 entry point for a CSV upload. */
export function runValidation(dataset: ParsedDataset, rawRows: RawTradeRow[]): ValidationReport {
  const issues: ValidationIssue[] = [...dataset.issues];

  // ---- Missing Values (on raw rows, before any defaulting happened) ----
  for (const row of rawRows) {
    const idx = row.Index?.trim();
    if (!idx) continue;
    const isParent = /^\d+$/.test(idx);
    if (isParent) {
      const requiredParentFields: (keyof RawTradeRow)[] = ['Entry Date', 'Entry Time', 'Exit Date', 'Exit Time', 'P/L'];
      for (const f of requiredParentFields) {
        pushIf(issues, !row[f]?.trim(), {
          tradeId: idx, rowNumber: -1, severity: 'error', code: 'MISSING_VALUE',
          message: `Trade ${idx}: missing "${f}".`,
        });
      }
    } else {
      const requiredLegFields: (keyof RawTradeRow)[] = ['Type', 'Strike', 'B/S', 'Qty', 'Entry Price', 'Exit Price', 'P/L'];
      for (const f of requiredLegFields) {
        pushIf(issues, !row[f]?.trim(), {
          tradeId: idx, rowNumber: -1, severity: 'error', code: 'MISSING_VALUE',
          message: `Leg ${idx}: missing "${f}".`,
        });
      }
    }
  }

  issues.push(...validateTrades(dataset.trades));
  return buildReport(dataset.trades, issues, dataset.totalRawRows, dataset.skippedRows);
}

/**
 * Stage 1 entry point for an Upstox trade sync — same per-trade business
 * rules as a CSV upload, plus the sync's own "couldn't reconstruct this
 * leg" notes surfaced as warnings in the same report shape (see
 * `tradeSync.ts` on the backend for what generates `skippedNotes`).
 */
export function buildSyncValidationReport(trades: Trade[], skippedNotes: string[]): ValidationReport {
  const issues: ValidationIssue[] = [
    ...validateTrades(trades),
    ...skippedNotes.map((note): ValidationIssue => ({
      tradeId: 'upstox-sync', rowNumber: -1, severity: 'warning', code: 'UPSTOX_SYNC_SKIPPED', message: note,
    })),
  ];
  return buildReport(trades, issues, trades.length, 0);
}
