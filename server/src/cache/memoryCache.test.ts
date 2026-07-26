import { describe, expect, it, vi } from 'vitest';
import { clearCache, getOrFetch } from './memoryCache';

describe('getOrFetch', () => {
  it('calls the fetcher on a miss and caches the result', async () => {
    clearCache();
    const fetcher = vi.fn().mockResolvedValue('fresh-value');
    const result = await getOrFetch('key-a', 10_000, fetcher);
    expect(result).toBe('fresh-value');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('serves the cached value on a hit without calling the fetcher again', async () => {
    clearCache();
    const fetcher = vi.fn().mockResolvedValue('only-called-once');
    await getOrFetch('key-b', 10_000, fetcher);
    const second = await getOrFetch('key-b', 10_000, fetcher);
    expect(second).toBe('only-called-once');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('re-fetches once the TTL has expired', async () => {
    clearCache();
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
      const first = await getOrFetch('key-c', 1_000, fetcher);
      expect(first).toBe('v1');

      vi.advanceTimersByTime(1_001);

      const second = await getOrFetch('key-c', 1_000, fetcher);
      expect(second).toBe('v2');
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps different keys independent', async () => {
    clearCache();
    await getOrFetch('key-x', 10_000, async () => 'x');
    await getOrFetch('key-y', 10_000, async () => 'y');
    expect(await getOrFetch('key-x', 10_000, async () => 'should-not-run')).toBe('x');
    expect(await getOrFetch('key-y', 10_000, async () => 'should-not-run')).toBe('y');
  });
});
