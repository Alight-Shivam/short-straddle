import { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import { buildTemplateCsv, CSV_COLUMNS, CSV_COLUMN_DESCRIPTIONS } from '../../formulas/csvSchema';
import { downloadTextFile } from '../../utils/downloadCsv';
import { formatDateOnly } from '../../formulas/liveMarket/expiryCalendar';
import { useUpstox } from '../../upstox/UpstoxContext';
import { upstoxApi } from '../../upstox/api';
import type { Trade } from '../../types/trade';

interface FileUploadProps {
  onFile: (file: File) => void;
  onSyncedTrades: (trades: Trade[], skipped: string[]) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

/** Upstox's own trade-history retention limit — used only as the pre-filled default, the user can widen/narrow it. */
function defaultStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 3);
  return formatDateOnly(d);
}

export function FileUpload({ onFile, onSyncedTrades, isLoading, errorMessage }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { status, login } = useUpstox();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(() => formatDateOnly(new Date()));

  const handleSync = useCallback(async () => {
    if (!status.connected) {
      login();
      return;
    }
    setSyncing(true);
    setSyncError(null);
    try {
      const { trades, skipped } = await upstoxApi.syncTrades(startDate, endDate);
      onSyncedTrades(trades, skipped);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync trades from Upstox.');
    } finally {
      setSyncing(false);
    }
  }, [status.connected, login, onSyncedTrades, startDate, endDate]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.name.toLowerCase().endsWith('.csv')) return;
      onFile(file);
    },
    [onFile],
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-100">Short Straddle Backtest Analyzer</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sync your trade history straight from Upstox, or upload a CSV — both feed the same validation and analytics dashboard.
        </p>
      </div>

      <div className="card flex flex-col items-center gap-3 border-sky-900/60 bg-sky-950/10 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-400">Primary · Recommended</span>
        <h2 className="text-base font-semibold text-slate-100">Sync from Upstox</h2>
        <p className="max-w-md text-sm text-slate-400">
          Pulls your own executed F&O trades and reconstructs your straddle log automatically — no manual export needed. Choose the
          date range to pull (Upstox only retains the last 3 years of trade history).
        </p>
        <div className="flex flex-wrap items-end justify-center gap-3">
          <label className="flex flex-col gap-1 text-left text-xs text-slate-400">
            Start date
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-left text-xs text-slate-400">
            End date
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={formatDateOnly(new Date())}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200"
            />
          </label>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {syncing ? 'Syncing…' : status.connected ? 'Sync my trades' : 'Connect & sync'}
        </button>
        {syncError && <p className="text-xs text-rose-400">{syncError}</p>}
        {status.connected && (
          <p className="text-xs text-slate-500">
            Note: synced trades carry the trade date but not the exact execution time or that day's VIX (Upstox's trade-history API
            doesn't return either) — Entry/Exit Time and Volatility analysis won't be meaningful for them. Everything else (P&L,
            drawdown, streaks, day/month/year breakdowns, ROI, …) works the same as a CSV upload.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <div className="h-px flex-1 bg-slate-800" />
        or upload a CSV
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 transition-colors',
          dragOver ? 'border-sky-500 bg-sky-500/5' : 'border-slate-700 bg-slate-900/40 hover:border-slate-600',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <svg className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        <p className="text-sm font-medium text-slate-200">{isLoading ? 'Parsing…' : 'Drop your CSV here, or click to browse'}</p>
        <p className="text-xs text-slate-500">Must match the required column template — see below.</p>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">{errorMessage}</div>
      )}

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => downloadTextFile(buildTemplateCsv(), 'short-straddle-template.csv')}
          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
        >
          Download CSV template
        </button>
        <button onClick={() => setShowSchema((s) => !s)} className="text-sm text-slate-400 underline underline-offset-2 hover:text-slate-200">
          {showSchema ? 'Hide' : 'Show'} required columns
        </button>
      </div>

      {showSchema && (
        <div className="card text-left text-xs">
          <table className="w-full">
            <tbody>
              {CSV_COLUMNS.map((c) => (
                <tr key={c} className="align-top">
                  <td className="whitespace-nowrap py-1 pr-3 font-mono font-semibold text-sky-400">{c}</td>
                  <td className="py-1 text-slate-400">{CSV_COLUMN_DESCRIPTIONS[c]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
