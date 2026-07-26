import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUpstox } from '../../upstox/UpstoxContext';
import { upstoxApi } from '../../upstox/api';
import type { OptionChainRow } from '../../types/liveMarket';
import { computeOverallPcr } from '../../formulas/liveMarket/pcr';
import { computeMaxPain } from '../../formulas/liveMarket/maxPain';
import { atmIv, findAtmRow } from '../../formulas/liveMarket/ivMetrics';
import { computeStraddlePayoff } from '../../formulas/liveMarket/straddlePayoff';
import { KpiCard } from '../ui/KpiCard';
import { ChartCard } from '../ui/ChartCard';
import { DataTable, type Column } from '../ui/DataTable';
import { SimpleLineChart } from '../ui/charts';
import { formatCurrency, formatNumber, formatPct } from '../../utils/format';

const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];
const EXPIRIES = [
  { value: 'current_week', label: 'Current Week' },
  { value: 'next_week', label: 'Next Week' },
  { value: 'current_month', label: 'Current Month' },
  { value: 'next_month', label: 'Next Month' },
];
/** Polling cadence for the option chain. Upstox's standard rate limit (50/sec, 500/min) leaves huge headroom here — kept slow to be a good citizen. */
const POLL_INTERVAL_MS = 10_000;

export function LiveMarketPage() {
  const { status, loading, login } = useUpstox();
  const [symbol, setSymbol] = useState('NIFTY');
  const [expiry, setExpiry] = useState('current_week');
  const [rows, setRows] = useState<OptionChainRow[] | null>(null);
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchChain = useCallback(async () => {
    if (!status.connected) return;
    try {
      const res = await upstoxApi.optionChain(symbol, expiry);
      setRows(res.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the option chain.');
    }
  }, [symbol, expiry, status.connected]);

  useEffect(() => {
    fetchChain();
    const id = setInterval(fetchChain, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchChain]);

  const pcr = useMemo(() => (rows ? computeOverallPcr(rows) : 0), [rows]);
  const maxPain = useMemo(() => (rows ? computeMaxPain(rows) : { maxPainStrike: null, curve: [] }), [rows]);
  const iv = useMemo(() => (rows ? atmIv(rows) : null), [rows]);
  const atmRow = useMemo(() => (rows ? findAtmRow(rows) : null), [rows]);
  const spot = rows?.[0]?.underlying_spot_price ?? null;

  const activeStrike = selectedStrike ?? atmRow?.strike_price ?? null;
  const activeRow = rows?.find((r) => r.strike_price === activeStrike) ?? null;
  const payoff = useMemo(() => {
    if (!activeRow?.call_options || !activeRow?.put_options) return null;
    return computeStraddlePayoff({
      strike: activeRow.strike_price,
      ceEntryPrice: activeRow.call_options.market_data.ltp,
      peEntryPrice: activeRow.put_options.market_data.ltp,
      qty: 1,
    });
  }, [activeRow]);

  if (loading) return null;

  if (!status.connected) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-20 text-center">
        <h2 className="text-lg font-semibold text-slate-100">Connect your Upstox account</h2>
        <p className="text-sm text-slate-400">
          Live option-chain analytics (OI, Greeks, IV, PCR, Max Pain) and syncing your own trade history both need a Upstox login.
          Nothing is stored beyond your session — see <code className="text-xs text-slate-500">server/README.md</code> for what the backend does with it.
        </p>
        <button onClick={login} className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500">
          Connect to Upstox
        </button>
      </div>
    );
  }

  const cols: Column<OptionChainRow>[] = [
    { key: 'callOi', label: 'Call OI', align: 'right', render: (r) => formatNumber(r.call_options?.market_data.oi ?? 0) },
    { key: 'callIv', label: 'Call IV', align: 'right', render: (r) => (r.call_options?.option_greeks?.iv ? formatPct(r.call_options.option_greeks.iv) : '—') },
    { key: 'callLtp', label: 'Call LTP', align: 'right', render: (r) => formatCurrency(r.call_options?.market_data.ltp ?? 0) },
    {
      key: 'strike',
      label: 'Strike',
      align: 'center',
      render: (r) => (
        <button
          onClick={() => setSelectedStrike(r.strike_price)}
          className={`rounded px-2 py-0.5 font-semibold ${r.strike_price === activeStrike ? 'bg-sky-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}
        >
          {r.strike_price}
        </button>
      ),
    },
    { key: 'putLtp', label: 'Put LTP', align: 'right', render: (r) => formatCurrency(r.put_options?.market_data.ltp ?? 0) },
    { key: 'putIv', label: 'Put IV', align: 'right', render: (r) => (r.put_options?.option_greeks?.iv ? formatPct(r.put_options.option_greeks.iv) : '—') },
    { key: 'putOi', label: 'Put OI', align: 'right', render: (r) => formatNumber(r.put_options?.market_data.oi ?? 0) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200">
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={expiry} onChange={(e) => setExpiry(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200">
          {EXPIRIES.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-IN')} · refreshes every ${POLL_INTERVAL_MS / 1000}s` : 'Loading…'}
        </span>
      </div>

      {error && <div className="rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{error}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Spot" value={spot ? formatCurrency(spot) : '—'} />
        <KpiCard label="ATM IV" value={iv ? formatPct(iv) : '—'} />
        <KpiCard label="PCR (chain-wide)" value={pcr ? pcr.toFixed(2) : '—'} sub="Signal only with high OI/volume" />
        <KpiCard label="Max Pain" value={maxPain.maxPainStrike ? String(maxPain.maxPainStrike) : '—'} />
      </div>

      <ChartCard title={`${symbol} Option Chain`} subtitle={`Expiry: ${expiry.replace('_', ' ')} · click a strike to see its live straddle payoff below`}>
        <DataTable columns={cols} rows={rows ?? []} maxHeight={480} dense />
      </ChartCard>

      {payoff && activeRow && (
        <ChartCard
          title={`Live Short Straddle Payoff — Strike ${activeRow.strike_price}`}
          subtitle={`Expiry-day payoff only (ignores time decay before expiry). Breakevens: ${payoff.lowerBreakeven.toFixed(0)} / ${payoff.upperBreakeven.toFixed(0)} · Max profit: ${formatCurrency(payoff.maxProfit)}`}
        >
          <SimpleLineChart data={payoff.curve} xKey="spot" series={[{ dataKey: 'pnl', name: 'P/L at expiry' }]} />
        </ChartCard>
      )}
    </div>
  );
}
