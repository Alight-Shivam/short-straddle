import type { OptionChainRow } from '../../types/liveMarket';

/**
 * Put-Call Ratio = total Put OI / total Call OI across the chain (or a
 * strike subset). Upstox already returns a per-strike `pcr` field, but that
 * one strike's ratio isn't the sentiment indicator retail platforms show —
 * this aggregates across the whole chain, which is the standard definition.
 * PCR > 1 is conventionally read as bearish positioning (more puts written/
 * held), < 1 as bullish — but per the research behind this feature, PCR only
 * has any signal when backed by genuinely high OI/volume, and mainly in the
 * front (current) expiry after the first few days of its life. Don't present
 * it as a standalone buy/sell signal.
 */
export function computeOverallPcr(rows: OptionChainRow[]): number {
  let putOi = 0;
  let callOi = 0;
  for (const row of rows) {
    putOi += row.put_options?.market_data.oi ?? 0;
    callOi += row.call_options?.market_data.oi ?? 0;
  }
  return callOi > 0 ? putOi / callOi : 0;
}

export interface OiBuildupRow {
  strike: number;
  callOi: number;
  callOiChange: number;
  putOi: number;
  putOiChange: number;
}

/** Per-strike OI + OI-change table, the raw material for "OI buildup" (long/short buildup) reads. */
export function buildOiTable(rows: OptionChainRow[]): OiBuildupRow[] {
  return rows
    .map((row) => ({
      strike: row.strike_price,
      callOi: row.call_options?.market_data.oi ?? 0,
      callOiChange: (row.call_options?.market_data.oi ?? 0) - (row.call_options?.market_data.prev_oi ?? 0),
      putOi: row.put_options?.market_data.oi ?? 0,
      putOiChange: (row.put_options?.market_data.oi ?? 0) - (row.put_options?.market_data.prev_oi ?? 0),
    }))
    .sort((a, b) => a.strike - b.strike);
}
