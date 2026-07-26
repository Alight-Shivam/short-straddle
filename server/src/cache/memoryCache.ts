/**
 * A deliberately tiny in-memory TTL cache — the "avoid duplicate API
 * requests" half of the Historical Data Engine, without introducing a
 * database. Scoped to this process's lifetime only: it resets on every
 * server restart and isn't shared across instances. That's an intentional,
 * temporary tradeoff (see the roadmap) — the DB phase later replaces this
 * with a persistent store so repeat runs (e.g. the Strategy Optimizer
 * re-fetching the same historical window) don't start from cold every time.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Returns the cached value for `key` if it hasn't expired, otherwise calls `fetcher`, caches the result for `ttlMs`, and returns it. */
export async function getOrFetch<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = store.get(key);
  if (existing && existing.expiresAt > now) return existing.value as T;

  const value = await fetcher();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Mostly for tests — drops everything cached so far. */
export function clearCache(): void {
  store.clear();
}

export function cacheSize(): number {
  return store.size;
}

/** Common TTL presets, named by what they're for rather than their raw millisecond value, so call sites read as intent. */
export const CACHE_TTL = {
  /** Live option-chain / quote snapshots change every second in principle, but batching identical near-simultaneous requests (e.g. two browser tabs polling) is still worth a few seconds of staleness. */
  LIVE_SNAPSHOT_MS: 3_000,
  /** Historical candles for a date range that's fully in the past never change; a range including "today" might still be updating intraday, so this stays a few minutes rather than "forever". */
  HISTORICAL_CANDLE_MS: 5 * 60_000,
} as const;
