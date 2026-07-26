/**
 * Shapes for the Upstox-backed "live market" feature. Used by both the
 * backend (server/src/upstox/upstoxClient.ts, which fetches and re-shapes
 * the raw Upstox response into this) and the frontend (Live Market tab) —
 * one definition, so the two sides can't silently drift apart.
 */

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
  pop?: number;
}

export interface OptionLegQuote {
  instrument_key: string;
  market_data: {
    ltp: number;
    close_price: number;
    volume: number;
    oi: number;
    bid_price?: number;
    ask_price?: number;
    prev_oi?: number;
  };
  option_greeks?: OptionGreeks;
}

export interface OptionChainRow {
  strike_price: number;
  expiry: string;
  pcr: number;
  underlying_key: string;
  underlying_spot_price: number;
  call_options?: OptionLegQuote;
  put_options?: OptionLegQuote;
}

export interface OptionChainResponse {
  status: string;
  data: OptionChainRow[];
}
