import { getLtpQuotes } from '../upstox/upstoxClient.js';

/**
 * "Live Tick Engine (in-memory only)" — deliberately polling-based, not a
 * true push WebSocket. Upstox's live streaming feed (v3 Market Data Feed)
 * is binary/protobuf-encoded against a schema that shifts across Upstox API
 * versions; implementing that blind, with no way to test it against a live
 * feed from this environment, risks shipping something that looks complete
 * but silently breaks. Polling Upstox's already-proven LTP endpoint
 * (`getLtpQuotes`, used elsewhere in this app) and building candles from the
 * ticks server-side gets the same practical outcome — an in-memory,
 * multi-timeframe candle stream that's lost on restart — at much lower risk.
 * If a true WebSocket feed is wanted later, this module's `Tick`/`Candle`
 * shapes and the route that serves them don't need to change, only how they
 * get fed.
 */

export type Timeframe = '1m' | '5m' | '15m';

const TIMEFRAME_MINUTES: Record<Timeframe, number> = { '1m': 1, '5m': 5, '15m': 15 };
export const ALL_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m'];

export interface Tick {
  timestamp: number; // epoch ms
  price: number;
}

export interface Candle {
  timestamp: number; // epoch ms, bucket start
  open: number;
  high: number;
  low: number;
  close: number;
  tickCount: number;
}

interface InstrumentState {
  ticks: Tick[];
  candles: Record<Timeframe, Candle[]>;
  lastFetchedAt: number;
  consecutiveFailures: number;
}

const MIN_POLL_INTERVAL_MS = 3_000; // don't hit Upstox more than once per 3s per instrument, regardless of frontend poll rate
const MAX_TICKS_RETAINED = 500;
const MAX_CANDLES_RETAINED = 200; // per timeframe — bounds memory since nothing here is ever persisted
const IDLE_EVICT_MS = 30 * 60_000; // drop an instrument's state if nobody's asked about it in 30 min

const store = new Map<string, InstrumentState>();

function newState(): InstrumentState {
  return { ticks: [], candles: { '1m': [], '5m': [], '15m': [] }, lastFetchedAt: 0, consecutiveFailures: 0 };
}

function bucketStart(timestamp: number, timeframe: Timeframe): number {
  const bucketMs = TIMEFRAME_MINUTES[timeframe] * 60_000;
  return Math.floor(timestamp / bucketMs) * bucketMs;
}

function applyTick(state: InstrumentState, tick: Tick): void {
  state.ticks.push(tick);
  if (state.ticks.length > MAX_TICKS_RETAINED) state.ticks.splice(0, state.ticks.length - MAX_TICKS_RETAINED);

  for (const tf of ALL_TIMEFRAMES) {
    const bucket = bucketStart(tick.timestamp, tf);
    const series = state.candles[tf];
    const last = series[series.length - 1];
    if (last && last.timestamp === bucket) {
      last.high = Math.max(last.high, tick.price);
      last.low = Math.min(last.low, tick.price);
      last.close = tick.price;
      last.tickCount += 1;
    } else {
      series.push({ timestamp: bucket, open: tick.price, high: tick.price, low: tick.price, close: tick.price, tickCount: 1 });
      if (series.length > MAX_CANDLES_RETAINED) series.splice(0, series.length - MAX_CANDLES_RETAINED);
    }
  }
}

/** Occasionally sweeps instruments nobody's polled in a while — avoids unbounded growth in the number of tracked instruments over a long-running server without needing a separate timer. */
function maybeEvictIdle(): void {
  if (Math.random() > 0.02) return; // ~1-in-50 calls
  const now = Date.now();
  for (const [key, state] of store) {
    if (now - state.lastFetchedAt > IDLE_EVICT_MS) store.delete(key);
  }
}

export interface LiveTickResult {
  instrumentKey: string;
  lastPrice: number | null;
  stale: boolean;
  lastFetchedAt: number | null;
  ticks: Tick[];
  candles: Partial<Record<Timeframe, Candle[]>>;
}

/** Lazily starts tracking `instrumentKey` on first call; every call after that appends at most one new tick (rate-limited to `MIN_POLL_INTERVAL_MS`), then returns the requested timeframes' candles built so far this server run. */
export async function getLiveData(accessToken: string, instrumentKey: string, timeframes: Timeframe[]): Promise<LiveTickResult> {
  maybeEvictIdle();
  const state = store.get(instrumentKey) ?? newState();
  store.set(instrumentKey, state);

  const now = Date.now();
  if (now - state.lastFetchedAt >= MIN_POLL_INTERVAL_MS) {
    try {
      const res = await getLtpQuotes(accessToken, [instrumentKey]);
      const quote = Object.values(res.data)[0];
      if (quote) {
        applyTick(state, { timestamp: now, price: quote.last_price });
        state.consecutiveFailures = 0;
      }
      state.lastFetchedAt = now;
    } catch (err) {
      state.consecutiveFailures += 1;
      // Keep serving whatever's already buffered rather than erroring the whole request —
      // a transient Upstox hiccup shouldn't blank out a chart that already has data.
      if (state.ticks.length === 0) throw err;
    }
  }

  const candles: Partial<Record<Timeframe, Candle[]>> = {};
  for (const tf of timeframes) candles[tf] = state.candles[tf];

  return {
    instrumentKey,
    lastPrice: state.ticks.length ? state.ticks[state.ticks.length - 1].price : null,
    stale: state.consecutiveFailures > 0,
    lastFetchedAt: state.lastFetchedAt || null,
    ticks: state.ticks,
    candles,
  };
}

/** Test-only: clears all in-memory state between test cases. */
export function _resetForTests(): void {
  store.clear();
}
