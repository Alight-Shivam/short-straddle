import { useEffect, useRef, useState } from 'react';
import type { Trade } from '../../types/trade';
import type { AnalysisReport } from '../../formulas';

// Lazy-imported on first use — jspdf/write-excel-file pull in a few hundred KB
// (html2canvas, purify) that most page loads never need just to view the dashboard.
const loadExportUtils = () => import('../../utils/exportReport');

export function ExportMenu({ trades, report }: { trades: Trade[]; report: AnalysisReport }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const run = async (fn: (utils: Awaited<ReturnType<typeof loadExportUtils>>) => void | Promise<void>) => {
    setBusy(true);
    try {
      const utils = await loadExportUtils();
      await fn(utils);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={trades.length === 0 || busy}
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? 'Exporting…' : 'Export ▾'}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-48 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-lg">
          <button onClick={() => run((u) => u.exportTradesToCsv(trades))} className="block w-full rounded-md px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
            Trade Log (CSV)
          </button>
          <button onClick={() => run((u) => u.exportTradesToExcel(trades, report))} className="block w-full rounded-md px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
            Trade Log (Excel)
          </button>
          <button onClick={() => run((u) => u.exportSummaryToPdf(report))} className="block w-full rounded-md px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
            Summary Report (PDF)
          </button>
        </div>
      )}
    </div>
  );
}
