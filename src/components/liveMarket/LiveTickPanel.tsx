import { useEffect, useMemo, useState } from 'react';
import { upstoxApi, type LiveTickResult, type Timeframe } from '../../upstox/api';
import { ChartCard } from '../ui/ChartCard';
import { KpiCard } from '../ui/KpiCard';
import { SimpleLineChart } from '../ui/charts';
import { formatCurrency } from '../../utils/format';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m'];
/** Frontend poll cadence — the server itself won't hit Upstox more than once per 3s per instrument regardless (see tickEngine.ts), this just governs how often the UI checks in. */
const POLL_INTERVAL_MS = 4_000;

/**
 * "Live Tick Engine" panel — polls `/api/market/live-tick` for whichever
 * instrument the parent hands it (spot index or a specific option leg) and
 * renders the in-memory candle stream being built server-side. See
 * `server/src/liveTick/tickEngine.ts` for why this is polling-based rather
 * than a push WebSocket.
 */
export function LiveTickPanel({ instrumentKey, label }: { instrumentKey: string | null; label: string }) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [data, setData] = useState<LiveTickResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!instrumentKey) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await upstoxApi.liveTick(instrumentKey, TIMEFRAMES);
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load live ticks.');
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [instrumentKey]);

  const candles = data?.candles[timeframe] ?? [];
  const chartData = useMemo(
    () => candles.map((c) => ({ time: new Date(c.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), close: c.close })),
    [candles],
  );

  if (!instrumentKey) return null;

  return (
    <ChartCard
      title={`Live Tick / Candle Builder — ${label}`}
      subtitle="In-memory only — polls every few seconds, resets on server restart. No history before the page was opened."
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${timeframe === tf ? 'bg-sky-600 text-white' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}
            >
              {tf}
            </button>
          ))}
        </div>
        {data?.stale && <span className="text-xs font-medium text-amber-400">Stale — last poll to Upstox failed, showing buffered data</span>}
      </div>

      {error && <p className="mb-3 text-xs text-rose-400">{error}</p>}

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Last Price" value={data?.lastPrice ? formatCurrency(data.lastPrice, true) : '—'} />
        <KpiCard label={`${timeframe} Candles Built`} value={String(candles.length)} />
        <KpiCard label="Last Poll" value={data?.lastFetchedAt ? new Date(data.lastFetchedAt).toLocaleTimeString('en-IN') : '—'} />
      </div>

      {candles.length > 0 ? (
        <SimpleLineChart data={chartData} xKey="time" series={[{ dataKey: 'close', name: `${label} (${timeframe})` }]} height={220} />
      ) : (
        <p className="py-8 text-center text-sm text-slate-500">Building the first candle — check back in a few seconds.</p>
      )}
    </ChartCard>
  );
}
