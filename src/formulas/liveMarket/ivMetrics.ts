import type { OptionChainRow } from '../../types/liveMarket';

export interface IvSkewPoint {
  strike: number;
  callIv: number | null;
  putIv: number | null;
}

/**
 * NOTE: this is IV *skew* (how IV varies across strikes right now), not IV
 * *Rank* or *Percentile* (how today's IV compares to its own history) — this
 * app has no stored time series of past IV yet, so rank/percentile can't be
 * computed honestly. To add it: persist each day's ATM IV (e.g. one row/day
 * in a small server-side store) and compute
 * `(current - min) / (max - min)` over a trailing window for Rank, or the
 * percentage of days below current for Percentile. Deliberately not faked
 * here with a single day's data.
 */
export function buildIvSkew(rows: OptionChainRow[]): IvSkewPoint[] {
  return rows
    .map((row) => ({
      strike: row.strike_price,
      callIv: row.call_options?.option_greeks?.iv ?? null,
      putIv: row.put_options?.option_greeks?.iv ?? null,
    }))
    .sort((a, b) => a.strike - b.strike);
}

/** The chain row whose strike sits closest to the current underlying spot — i.e. today's ATM strike. */
export function findAtmRow(rows: OptionChainRow[]): OptionChainRow | null {
  if (rows.length === 0) return null;
  const spot = rows[0].underlying_spot_price;
  return rows.reduce((closest, row) => (Math.abs(row.strike_price - spot) < Math.abs(closest.strike_price - spot) ? row : closest), rows[0]);
}

/** Average of ATM call & put IV — the conventional single-number "IV" for the underlying right now. */
export function atmIv(rows: OptionChainRow[]): number | null {
  const atm = findAtmRow(rows);
  if (!atm) return null;
  const callIv = atm.call_options?.option_greeks?.iv;
  const putIv = atm.put_options?.option_greeks?.iv;
  if (callIv && putIv) return (callIv + putIv) / 2;
  return callIv ?? putIv ?? null;
}
