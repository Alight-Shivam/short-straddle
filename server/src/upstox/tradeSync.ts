import type { Trade, TradeLeg } from '../../../src/types/trade.js';
import { buildTrade } from '../../../src/formulas/buildTrade.js';
import { getHistoricalTrades, type HistoricalTradeRow } from './upstoxClient.js';

/**
 * Turns a user's raw Upstox trade history into this app's `Trade[]` shape —
 * the Upstox equivalent of `formulas/parseTrades.ts`'s CSV grouping, reusing
 * the SAME `buildTrade()` step so a synced trade scores identically to one
 * from a CSV upload.
 *
 * IMPORTANT LIMITATIONS (read before trusting the output):
 *
 * 1. `/v2/charges/historical-trades` gives a `trade_date` (calendar date)
 *    per fill, but NO execution timestamp. There is no way to recover
 *    what time a leg was opened/closed from this endpoint. Every synced
 *    trade is therefore stamped with a fixed 09:15/15:30 entry/exit time —
 *    good enough for day/week/month/year/streak/drawdown/ROI analysis
 *    (the bulk of this app), but the Entry Time, Exit Time and Duration
 *    analysis sections will be meaningless for synced data (every trade
 *    lands in the same bucket). If you need real intraday timestamps,
 *    combine this with the (same-day-only) Order Book / Order History
 *    APIs, which do carry them — not implemented here.
 * 2. India VIX at entry isn't part of a trade record either — synced
 *    trades get `vix: null` (Volatility Analysis will show 0 trades in
 *    every VIX bucket for them).
 * 3. Multiple fills for the same (date, underlying, option_type) are
 *    averaged into one leg by transaction_type (all SELLs -> entry price/
 *    qty, all BUYs -> exit price/qty). If you opened and closed the SAME
 *    leg more than once in a day (e.g. re-entered after squaring off), this
 *    collapses them into a single leg rather than two separate trades —
 *    same simplification the CSV format itself makes (one parent row/day).
 * 4. A leg that was sold but never bought back on the same day (held past
 *    that day, or expired worthless) has no closing fill in this endpoint.
 *    We only treat a leg as "closed" if we see a matching BUY; otherwise
 *    it's reported in `skipped` rather than guessed at.
 */

const DEFAULT_ENTRY_TIME = '09:15:00';
const DEFAULT_EXIT_TIME = '15:30:00';

export interface TradeSyncResult {
  trades: Trade[];
  /** Human-readable notes on data that couldn't be turned into a trade (still-open legs, unparseable rows, etc). */
  skipped: string[];
  totalRawFills: number;
}

interface FillAggregate {
  qty: number;
  notional: number; // price * qty, summed, so avg price = notional / qty
}

function addFill(agg: FillAggregate, row: HistoricalTradeRow): FillAggregate {
  return { qty: agg.qty + row.quantity, notional: agg.notional + row.price * row.quantity };
}

function avgPrice(agg: FillAggregate): number {
  return agg.qty > 0 ? agg.notional / agg.qty : 0;
}

function parseDateOnly(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

/** Groups same-day option fills into Trade[], per the limitations documented above. */
export function tradesFromHistoricalFills(rows: HistoricalTradeRow[]): TradeSyncResult {
  const optionRows = rows.filter((r) => r.segment === 'FO' && (r.option_type === 'CE' || r.option_type === 'PE'));

  type GroupKey = string;
  const groups = new Map<GroupKey, HistoricalTradeRow[]>();
  for (const row of optionRows) {
    const key = `${row.trade_date}|${row.scrip_name}|${row.expiry}`;
    const arr = groups.get(key);
    if (arr) arr.push(row);
    else groups.set(key, [row]);
  }

  const trades: Trade[] = [];
  const skipped: string[] = [];
  let rowNumber = 0;

  for (const [key, groupRows] of groups) {
    const [tradeDate] = key.split('|');
    const legs: TradeLeg[] = [];

    for (const optionType of ['CE', 'PE'] as const) {
      const legRows = groupRows.filter((r) => r.option_type === optionType);
      if (legRows.length === 0) continue;

      const sells = legRows.filter((r) => r.transaction_type === 'SELL').reduce(addFill, { qty: 0, notional: 0 });
      const buys = legRows.filter((r) => r.transaction_type === 'BUY').reduce(addFill, { qty: 0, notional: 0 });
      const strike = legRows[0].strike_price;

      if (sells.qty === 0 && buys.qty === 0) continue;

      if (sells.qty > 0 && buys.qty > 0 && sells.qty === buys.qty) {
        // Clean same-day short round-trip: entry = sell (open), exit = buy (close).
        const entryPrice = avgPrice(sells);
        const exitPrice = avgPrice(buys);
        const qty = sells.qty;
        legs.push({
          rowIndex: key,
          type: optionType,
          strike,
          side: 'Sell',
          qty,
          entryPrice,
          exitPrice,
          pnl: (entryPrice - exitPrice) * qty,
          entryDate: parseDateOnly(tradeDate),
          entryTime: DEFAULT_ENTRY_TIME,
          exitDate: parseDateOnly(tradeDate),
          exitTime: DEFAULT_EXIT_TIME,
        });
      } else if (sells.qty > 0 && buys.qty > 0) {
        skipped.push(`${key} ${optionType}: sell qty (${sells.qty}) != buy qty (${buys.qty}) — partial fills across a boundary this sync can't reconstruct, skipped.`);
      } else if (sells.qty > 0) {
        skipped.push(`${key} ${optionType}: sold ${sells.qty} but no same-day closing buy found (still open, expired worthless, or closed on a later day) — skipped.`);
      } else {
        skipped.push(`${key} ${optionType}: bought ${buys.qty} with no matching same-day sell (looks like closing a position opened on an earlier day) — skipped.`);
      }
    }

    if (legs.length === 0) continue;

    rowNumber += 1;
    const entryDate = parseDateOnly(tradeDate);
    const exitDate = parseDateOnly(tradeDate);
    trades.push(
      buildTrade({
        id: `UPX-${tradeDate}-${rowNumber}`,
        rowNumber,
        entryDate,
        exitDate,
        vix: null,
        explicitPnl: null,
        legs,
      }),
    );
  }

  trades.sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  trades.forEach((t, i) => (t.rowNumber = i + 1));

  return { trades, skipped, totalRawFills: rows.length };
}

/** Paginates through the full `historical-trades` window and runs it through the transform above. */
export async function syncTradesFromUpstox(
  accessToken: string,
  opts: { startDate: string; endDate: string },
): Promise<TradeSyncResult> {
  const allRows: HistoricalTradeRow[] = [];
  let page = 1;
  const pageSize = 500;
  for (;;) {
    const res = await getHistoricalTrades(accessToken, { segment: 'FO', startDate: opts.startDate, endDate: opts.endDate, pageNumber: page, pageSize });
    allRows.push(...res.data);
    const meta = res.meta_data;
    if (!meta || page >= meta.total_pages || res.data.length === 0) break;
    page += 1;
  }
  return tradesFromHistoricalFills(allRows);
}
