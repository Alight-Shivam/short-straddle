interface Props {
  tradeCount: number;
  startingCapital: number;
  onStartingCapitalChange: (v: number) => void;
  onReset: () => void;
}

export function Header({ tradeCount, startingCapital, onStartingCapitalChange, onReset }: Props) {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/90 px-6 py-3 backdrop-blur">
      <div>
        <h1 className="text-base font-semibold text-slate-100">Short Straddle Backtest Analyzer</h1>
        <p className="text-xs text-slate-500">{tradeCount} trades loaded</p>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Starting Capital
          <input
            type="number"
            value={startingCapital}
            onChange={(e) => onStartingCapitalChange(Number(e.target.value) || 0)}
            className="w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
          />
        </label>
        <button onClick={onReset} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800">
          Upload new file
        </button>
      </div>
    </header>
  );
}
