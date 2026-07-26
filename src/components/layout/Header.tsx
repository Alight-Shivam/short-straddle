import type { Trade } from '../../types/trade';
import type { AnalysisReport } from '../../formulas';
import { ExportMenu } from './ExportMenu';

interface Props {
  tradeCount: number;
  startingCapital: number;
  onStartingCapitalChange: (v: number) => void;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  onDateRangeChange: (start: string | null, end: string | null) => void;
  onReset: () => void;
  filteredTrades: Trade[];
  report: AnalysisReport;
}

export function Header({
  tradeCount,
  startingCapital,
  onStartingCapitalChange,
  dateRangeStart,
  dateRangeEnd,
  onDateRangeChange,
  onReset,
  filteredTrades,
  report,
}: Props) {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/90 px-6 py-3 backdrop-blur">
      <div>
        <h1 className="text-base font-semibold text-slate-100">Short Straddle Backtest Analyzer</h1>
        <p className="text-xs text-slate-500">{tradeCount} trades loaded</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Start Date
          <input
            type="date"
            value={dateRangeStart ?? ''}
            max={dateRangeEnd ?? undefined}
            onChange={(e) => onDateRangeChange(e.target.value || null, dateRangeEnd)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          End Date
          <input
            type="date"
            value={dateRangeEnd ?? ''}
            min={dateRangeStart ?? undefined}
            onChange={(e) => onDateRangeChange(dateRangeStart, e.target.value || null)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
          />
        </label>
        {(dateRangeStart || dateRangeEnd) && (
          <button onClick={() => onDateRangeChange(null, null)} className="text-xs font-medium text-rose-400 hover:text-rose-300">
            Clear dates
          </button>
        )}
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Starting Capital
          <input
            type="number"
            value={startingCapital}
            onChange={(e) => onStartingCapitalChange(Number(e.target.value) || 0)}
            className="w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
          />
        </label>
        <ExportMenu trades={filteredTrades} report={report} />
        <button onClick={onReset} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800">
          Upload new file
        </button>
      </div>
    </header>
  );
}
