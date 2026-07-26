import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../upstox/upstoxClient.js', () => ({
  getLtpQuotes: vi.fn(),
}));

import { getLtpQuotes } from '../upstox/upstoxClient.js';
import { _resetForTests, getLiveData } from './tickEngine';

const mockedGetLtpQuotes = vi.mocked(getLtpQuotes);

function mockPrice(price: number) {
  mockedGetLtpQuotes.mockResolvedValueOnce({ status: 'success', data: { KEY: { last_price: price, instrument_token: 'KEY' } } });
}

describe('getLiveData', () => {
  beforeEach(() => {
    _resetForTests();
    mockedGetLtpQuotes.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T09:15:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches a fresh tick on first call and builds a 1-tick candle', async () => {
    mockPrice(100);
    const result = await getLiveData('token', 'KEY', ['1m']);
    expect(result.lastPrice).toBe(100);
    expect(result.ticks).toHaveLength(1);
    expect(result.candles['1m']).toHaveLength(1);
    expect(result.candles['1m']![0]).toMatchObject({ open: 100, high: 100, low: 100, close: 100, tickCount: 1 });
    expect(mockedGetLtpQuotes).toHaveBeenCalledTimes(1);
  });

  it('does not re-fetch within the minimum poll interval', async () => {
    mockPrice(100);
    await getLiveData('token', 'KEY', ['1m']);
    vi.advanceTimersByTime(1_000); // under the 3s floor
    mockPrice(999); // would be used if a second fetch happened
    const second = await getLiveData('token', 'KEY', ['1m']);
    expect(second.lastPrice).toBe(100);
    expect(mockedGetLtpQuotes).toHaveBeenCalledTimes(1);
  });

  it('updates the same candle when a new tick lands in the same bucket, and opens a new one once the bucket rolls over', async () => {
    mockPrice(100);
    await getLiveData('token', 'KEY', ['1m']);

    vi.advanceTimersByTime(3_100); // still inside the same minute bucket
    mockPrice(105);
    const second = await getLiveData('token', 'KEY', ['1m']);
    expect(second.candles['1m']).toHaveLength(1);
    expect(second.candles['1m']![0]).toMatchObject({ open: 100, high: 105, low: 100, close: 105, tickCount: 2 });

    vi.advanceTimersByTime(60_000); // rolls into the next minute
    mockPrice(95);
    const third = await getLiveData('token', 'KEY', ['1m']);
    expect(third.candles['1m']).toHaveLength(2);
    expect(third.candles['1m']![1]).toMatchObject({ open: 95, high: 95, low: 95, close: 95, tickCount: 1 });
  });

  it('builds independent candle series per requested timeframe from the same ticks', async () => {
    mockPrice(100);
    await getLiveData('token', 'KEY', ['1m', '5m']);
    vi.advanceTimersByTime(65_000); // new 1m bucket, same 5m bucket
    mockPrice(110);
    const result = await getLiveData('token', 'KEY', ['1m', '5m']);
    expect(result.candles['1m']).toHaveLength(2);
    expect(result.candles['5m']).toHaveLength(1);
    expect(result.candles['5m']![0]).toMatchObject({ open: 100, close: 110, tickCount: 2 });
  });

  it('marks the result stale after a failed fetch but keeps serving buffered data', async () => {
    mockPrice(100);
    await getLiveData('token', 'KEY', ['1m']);

    vi.advanceTimersByTime(3_100);
    mockedGetLtpQuotes.mockRejectedValueOnce(new Error('upstream down'));
    const result = await getLiveData('token', 'KEY', ['1m']);
    expect(result.stale).toBe(true);
    expect(result.lastPrice).toBe(100); // still serves the last good tick
  });

  it('throws if the very first fetch fails (nothing buffered to fall back on)', async () => {
    mockedGetLtpQuotes.mockRejectedValueOnce(new Error('upstream down'));
    await expect(getLiveData('token', 'KEY', ['1m'])).rejects.toThrow('upstream down');
  });

  it('keeps separate instruments independent', async () => {
    mockPrice(100);
    await getLiveData('token', 'KEY_A', ['1m']);
    mockPrice(200);
    await getLiveData('token', 'KEY_B', ['1m']);
    const a = await getLiveData('token', 'KEY_A', ['1m']);
    const b = await getLiveData('token', 'KEY_B', ['1m']);
    expect(a.lastPrice).toBe(100);
    expect(b.lastPrice).toBe(200);
  });
});
