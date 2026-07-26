import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUpstox } from '../../upstox/UpstoxContext';
import { upstoxApi, type CandleUnit } from '../../upstox/api';
import type { OptionChainRow } from '../../types/liveMarket';
import { formatDateOnly } from '../../formulas/liveMarket/expiryCalendar';
import { KpiCard } from '../ui/KpiCard';
import { ChartCard } from '../ui/ChartCard';
import { DataTable, type Column } from '../ui/DataTable';
import { SimpleLineChart, MultiBarChart } from '../ui/charts';
import { formatCurrency, formatNumber } from '../../utils/format';

const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];
const EXPIRIES = [
  { value: 'current_week', label: 'Current Week' },
  { value: 'next_week', label: 'Next Week' },
  { value: 'current_month', label: 'Current Month' },
  { value: 'next_month', label: 'Next Month' },
];
const UNITS: { value: CandleUnit; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
];

interface Candle {
  timestamp: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}

function parseCandles(raw: [string, number, number, number, number, number, number][]): Candle[] {
  return raw
    .map(([timestamp, open, high, low, close, volume, oi]) => ({
      timestamp,
      date: new Date(timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
      open,
      high,
      low,
      close,
      volume,
      oi,
    }))
    // Upstox returns newest-first; charts/tables here read left-to-right chronologically.
    .reverse();
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return formatDateOnly(d);
}

/**
 * "Historical Market Data" — on-demand replay of past spot/option OHLC
 * candles, the UI for the Historical Data Engine's `/historical-spot` and
 * `/historical-option` routes (built earlier, previously unused by any page).
 * No storage: every query re-fetches from Upstox live, same in-memory-cache
 * tradeoff documented in server/README.md.
 */
export function HistoricalDataPage() {
  const { status, loading, login } = useUpstox();
  const [instrumentType, setInstrumentType] = useState<'spot' | 'option'>('spot');
  const [symbol, setSymbol] = useState('NIFTY');
  const [unit, setUnit] = useState<CandleUnit>('days');
  const [interval, setInterval_] = useState(1);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(() => formatDateOnly(new Date()));

  // Option-contract lookup (current chain only — historical-option only works for contracts that haven't expired).
  const [expiry, setExpiry] = useState('current_week');
  const [chain, setChain] = useState<OptionChainRow[] | null>(null);
  const [strike, setStrike] = useState<number | null>(null);
  const [optionSide, setOptionSide] = useState<'CE' | 'PE'>('CE');
  const [chainError, setChainError] = useState<string | null>(null);

  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [candleError, setCandleError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (instrumentType !== 'option' || !status.connected) return;
    upstoxApi
      .optionChain(symbol, expiry)
      .then((res) => {
        setChain(res.data);
        setChainError(null);
        setStrike((prev) => prev ?? res.data[Math.floor(res.data.length / 2)]?.strike_price ?? null);
      })
      .catch((err) => setChainError(err instanceof Error ? err.message : 'Failed to load the option chain.'));
  }, [instrumentType, symbol, expiry, status.connected]);

  const activeRow = chain?.find((r) => r.strike_price === strike) ?? null;
  const instrumentKey = optionSide === 'CE' ? activeRow?.call_options?.instrument_key : activeRow?.put_options?.instrument_key;

  const runFetch = useCallback(async () => {
    setFetching(true);
    setCandleError(null);
    try {
      const res =
        instrumentType === 'spot'
          ? await upstoxApi.historicalSpot(symbol, unit, interval, from, to)
          : instrumentKey
            ? await upstoxApi.historicalOption(instrumentKey, unit, interval, from, to)
            : null;
      if (!res) {
        setCandleError('Pick a strike from the chain below first.');
        setCandles(null);
        return;
      }
      setCandles(parseCandles(res.data.candles));
    } catch (err) {
      setCandleError(err instanceof Error ? err.message : 'Failed to load historical candles.');
      setCandles(null);
    } finally {
      setFetching(false);
    }
  }, [instrumentType, symbol, unit, interval, from, to, instrumentKey]);

  const lineData = useMemo(() => candles?.map((c) => ({ date: c.date, close: c.close })) ?? [], [candles]);
  const volumeData = useMemo(() => candles?.map((c) => ({ date: c.date, volume: c.volume })) ?? [], [candles]);
  const latest = candles?.[candles.length - 1] ?? null;
  const first = candles?.[0] ?? null;
  const changePct = latest && first && first.close !== 0 ? ((latest.close - first.close) / first.close) * 100 : null;

  if (loading) return null;

  if (!status.connected) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-20 text-center">
        <h2 className="text-lg font-semibold text-slate-100">Connect your Upstox account</h2>
        <p className="text-sm text-slate-400">
          Historical spot/option candles are pulled on-demand from Upstox — no data is stored between queries, so each search re-fetches live.
        </p>
        <button onClick={login} className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500">
          Connect to Upstox
        </button>
      </div>
    );
  }

  const cols: Column<Candle>[] = [
    { key: 'date', label: 'Date/Time', render: (c) => c.date },
    { key: 'open', label: 'Open', align: 'right', render: (c) => formatCurrency(c.open, true) },
    { key: 'high', label: 'High', align: 'right', render: (c) => formatCurrency(c.high, true) },
    { key: 'low', label: 'Low', align: 'right', render: (c) => formatCurrency(c.low, true) },
    { key: 'close', label: 'Close', align: 'right', render: (c) => formatCurrency(c.close, true) },
    { key: 'volume', label: 'Volume', align: 'right', render: (c) => formatNumber(c.volume) },
    { key: 'oi', label: 'OI', align: 'right', render: (c) => formatNumber(c.oi) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select value={instrumentType} onChange={(e) => setInstrumentType(e.target.value as 'spot' | 'option')} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200">
            <option value="spot">Spot Index</option>
            <option value="option">Option Contract</option>
          </select>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200">
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {instrumentType === 'option' && (
            <>
              <select value={expiry} onChange={(e) => setExpiry(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200">
                {EXPIRIES.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
              <select value={strike ?? ''} onChange={(e) => setStrike(Number(e.target.value))} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200">
                {(chain ?? []).map((r) => (
                  <option key={r.strike_price} value={r.strike_price}>{r.strike_price}</option>
                ))}
              </select>
              <select value={optionSide} onChange={(e) => setOptionSide(e.target.value as 'CE' | 'PE')} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200">
                <option value="CE">CE</option>
                <option value="PE">PE</option>
              </select>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            From
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            To
            <input type="date" value={to} min={from} max={formatDateOnly(new Date())} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Unit
            <select value={unit} onChange={(e) => setUnit(e.target.value as CandleUnit)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200">
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Interval
            <input type="number" min={1} value={interval} onChange={(e) => setInterval_(Math.max(1, Number(e.target.value)))} className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200" />
          </label>
          <button onClick={runFetch} disabled={fetching} className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60">
            {fetching ? 'Loading…' : 'Load Candles'}
          </button>
        </div>

        {instrumentType === 'option' && (
          <p className="text-xs text-slate-500">
            Only works for contracts that haven't expired yet (Upstox limitation — expired series need the separate, paid Expired Instruments tier).
            {activeRow ? ` Resolved instrument: ${instrumentKey ?? '—'}` : ''}
          </p>
        )}
        {chainError && <p className="text-xs text-rose-400">{chainError}</p>}
      </div>

      {candleError && <div className="rounded-lg border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{candleError}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Candles Loaded" value={formatNumber(candles?.length ?? 0)} />
        <KpiCard label="First Close" value={first ? formatCurrency(first.close, true) : '—'} />
        <KpiCard label="Last Close" value={latest ? formatCurrency(latest.close, true) : '—'} />
        <KpiCard label="Change" value={changePct !== null ? `${changePct.toFixed(2)}%` : '—'} tone={changePct !== null ? (changePct >= 0 ? 'good' : 'bad') : 'neutral'} />
      </div>

      <ChartCard title="Close Price" isEmpty={!candles || candles.length === 0} emptyMessage="No candles loaded yet — set a range above and click Load Candles.">
        <SimpleLineChart data={lineData} xKey="date" series={[{ dataKey: 'close', name: 'Close' }]} />
      </ChartCard>

      <ChartCard title="Volume" isEmpty={!candles || candles.length === 0} emptyMessage="No candles loaded yet.">
        <MultiBarChart data={volumeData} xKey="date" series={[{ dataKey: 'volume', name: 'Volume' }]} />
      </ChartCard>

      <ChartCard title="OHLCV Table" isEmpty={!candles || candles.length === 0} emptyMessage="No candles loaded yet.">
        <DataTable columns={cols} rows={candles ?? []} maxHeight={480} dense />
      </ChartCard>
    </div>
  );
}
