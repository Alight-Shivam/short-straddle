import type { RawTradeRow, Trade, TradeLeg, ParsedDataset, ValidationIssue } from '../types/trade';
import { CSV_COLUMNS } from './csvSchema';

/** Standard NSE cash-market session close used to flag "early" exits. Change here if needed. */
export const SESSION_CLOSE_TIME = '15:15:00';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Normalizes header names so minor casing/whitespace differences in an upload still match. */
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

const HEADER_LOOKUP = new Map(CSV_COLUMNS.map((c) => [normalizeHeader(c), c]));

/** Remaps an arbitrary parsed-CSV row's keys onto the canonical column names. */
export function mapRowToSchema(row: Record<string, unknown>): RawTradeRow {
  const out: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    const canonical = HEADER_LOOKUP.get(normalizeHeader(key));
    if (canonical) out[canonical] = String(row[key] ?? '').trim();
  }
  for (const col of CSV_COLUMNS) if (!(col in out)) out[col] = '';
  return out as unknown as RawTradeRow;
}

export function verifyRequiredColumns(headers: string[]): { ok: boolean; missing: string[] } {
  const normalized = new Set(headers.map(normalizeHeader));
  const missing = CSV_COLUMNS.filter((c) => !normalized.has(normalizeHeader(c)));
  return { ok: missing.length === 0, missing };
}

function toNumber(v: string | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Parses "YYYY-MM-DD" + " 9:20:00 AM" into a single local Date. Returns null if unparsable. */
export function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const d = (dateStr || '').trim();
  const t = (timeStr || '').trim();
  if (!d) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!dateMatch) return null;
  const [, y, mo, da] = dateMatch;

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (t) {
    const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(t);
    if (timeMatch) {
      hours = Number(timeMatch[1]);
      minutes = Number(timeMatch[2]);
      seconds = Number(timeMatch[3] ?? 0);
      const meridiem = timeMatch[4]?.toUpperCase();
      if (meridiem === 'PM' && hours !== 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
    }
  }
  return new Date(Number(y), Number(mo) - 1, Number(da), hours, minutes, seconds);
}

/** Returns "HH:mm:ss" (24h) for stable display/bucketing regardless of input format. */
export function formatTime24(d: Date | null): string {
  if (!d) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function isParentIndex(index: string): boolean {
  return /^\d+$/.test(index.trim());
}

interface RawGroup {
  parent: RawTradeRow | null;
  parentRowNumber: number;
  legs: { row: RawTradeRow; rowNumber: number }[];
}

/**
 * Groups the flat list of raw rows into parent+legs clusters based on the
 * `Index` column ("1" = parent, "1.1"/"1.2" = legs of trade 1).
 */
function groupRows(rows: RawTradeRow[]): RawGroup[] {
  const groups: RawGroup[] = [];
  let current: RawGroup | null = null;

  rows.forEach((row, i) => {
    const idx = (row.Index || '').trim();
    if (idx === '') return; // fully blank row, ignore
    if (isParentIndex(idx)) {
      current = { parent: row, parentRowNumber: i + 1, legs: [] };
      groups.push(current);
    } else {
      if (!current) {
        // Orphan leg with no preceding parent — create a synthetic group so data isn't lost.
        current = { parent: null, parentRowNumber: i + 1, legs: [] };
        groups.push(current);
      }
      current.legs.push({ row, rowNumber: i + 1 });
    }
  });
  return groups;
}

function buildLeg(row: RawTradeRow, rowNumber: number): { leg: TradeLeg | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const type = row.Type.trim().toUpperCase();
  if (type !== 'CE' && type !== 'PE') {
    issues.push({
      tradeId: row.Index,
      rowNumber,
      severity: 'error',
      code: 'WRONG_TYPE',
      message: `Leg row ${row.Index} has invalid Type "${row.Type}" (expected CE or PE).`,
    });
    return { leg: null, issues };
  }
  const side = row['B/S'].trim();
  const strike = toNumber(row.Strike);
  const qty = toNumber(row.Qty);
  const entryPrice = toNumber(row['Entry Price']);
  const exitPrice = toNumber(row['Exit Price']);
  const pnl = toNumber(row['P/L']);

  const leg: TradeLeg = {
    rowIndex: row.Index,
    type: type as 'CE' | 'PE',
    strike: strike ?? 0,
    side: (side === 'Buy' ? 'Buy' : 'Sell'),
    qty: qty ?? 0,
    entryPrice: entryPrice ?? 0,
    exitPrice: exitPrice ?? 0,
    pnl: pnl ?? 0,
    entryDate: parseDateTime(row['Entry Date'], row['Entry Time']),
    entryTime: formatTime24(parseDateTime(row['Entry Date'], row['Entry Time'])),
    exitDate: parseDateTime(row['Exit Date'], row['Exit Time']),
    exitTime: formatTime24(parseDateTime(row['Exit Date'], row['Exit Time'])),
  };
  return { leg, issues };
}

/**
 * Top-level entry point: raw parsed CSV objects (from PapaParse) -> ParsedDataset.
 * Structural grouping + light per-row parsing only. Deeper rule checks
 * (Stage 1 validations) live in `validation/rules.ts` and run separately.
 */
export function parseTrades(rawRows: Record<string, unknown>[]): ParsedDataset {
  const rows = rawRows.map(mapRowToSchema);
  const groups = groupRows(rows);
  const trades: Trade[] = [];
  const issues: ValidationIssue[] = [];
  let skipped = 0;

  for (const group of groups) {
    if (!group.parent) {
      issues.push({
        tradeId: group.legs[0]?.row.Index ?? 'unknown',
        rowNumber: group.parentRowNumber,
        severity: 'error',
        code: 'ORPHAN_LEG',
        message: `Leg row(s) found with no parent summary row before them.`,
      });
      skipped++;
      continue;
    }
    const p = group.parent;
    const entryDate = parseDateTime(p['Entry Date'], p['Entry Time']);
    const exitDate = parseDateTime(p['Exit Date'], p['Exit Time']);
    if (!entryDate || !exitDate) {
      issues.push({
        tradeId: p.Index,
        rowNumber: group.parentRowNumber,
        severity: 'error',
        code: 'BAD_DATE',
        message: `Trade ${p.Index} has an unparsable Entry/Exit date or time.`,
      });
      skipped++;
      continue;
    }

    const legs: TradeLeg[] = [];
    for (const { row, rowNumber } of group.legs) {
      const { leg, issues: legIssues } = buildLeg(row, rowNumber);
      issues.push(...legIssues);
      if (leg) legs.push(leg);
    }

    const ce = legs.find((l) => l.type === 'CE') ?? null;
    const pe = legs.find((l) => l.type === 'PE') ?? null;
    const vix = toNumber(p.Vix);
    const parentPnl = toNumber(p['P/L']);
    const legsPnlSum = legs.reduce((s, l) => s + l.pnl, 0);
    const pnl = parentPnl ?? legsPnlSum;

    const durationMs = exitDate.getTime() - entryDate.getTime();
    const durationMinutes = Math.max(0, Math.round(durationMs / 60000));

    const trade: Trade = {
      id: p.Index,
      rowNumber: group.parentRowNumber,
      entryDate,
      entryTime: formatTime24(entryDate),
      exitDate,
      exitTime: formatTime24(exitDate),
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
      isEarlyExit: formatTime24(exitDate) < SESSION_CLOSE_TIME,
    };
    trades.push(trade);
  }

  trades.sort((a, b) => a.rowNumber - b.rowNumber);

  return {
    trades,
    issues,
    totalRawRows: rawRows.length,
    skippedRows: skipped,
  };
}
