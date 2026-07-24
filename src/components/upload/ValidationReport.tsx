import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { ValidationReport } from '../../formulas/validation/rules';
import { DataTable, type Column } from '../ui/DataTable';
import type { ValidationIssue } from '../../types/trade';

interface Props {
  report: ValidationReport;
  onProceed: () => void;
  onReupload: () => void;
}

const severityStyles: Record<string, string> = {
  error: 'text-rose-400 bg-rose-950/40 border-rose-900',
  warning: 'text-amber-400 bg-amber-950/30 border-amber-900',
  info: 'text-sky-400 bg-sky-950/30 border-sky-900',
};

export function ValidationReportView({ report, onProceed, onReupload }: Props) {
  const [filterKey, setFilterKey] = useState<string | null>(null);

  const filteredIssues = useMemo(() => {
    if (!filterKey) return report.issues;
    const def = report.summary.find((s) => s.key === filterKey);
    if (!def) return report.issues;
    return report.issues.filter((i) => def.codes.includes(i.code));
  }, [filterKey, report]);

  const columns: Column<ValidationIssue>[] = [
    { key: 'severity', label: 'Severity', render: (r) => <span className={clsx('rounded px-1.5 py-0.5 text-[11px] font-medium', severityStyles[r.severity])}>{r.severity}</span> },
    { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-[11px] text-slate-400">{r.code}</span> },
    { key: 'tradeId', label: 'Trade', render: (r) => r.tradeId },
    { key: 'message', label: 'Message', render: (r) => <span className="text-slate-300">{r.message}</span> },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Stage 1 — Data Validation</h1>
        <p className="mt-1 text-sm text-slate-400">
          Parsed {report.totalRawRows} raw rows into {report.totalTrades} trades
          {report.skippedRows > 0 && <span className="text-rose-400"> ({report.skippedRows} rows skipped due to structural errors)</span>}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {report.summary.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilterKey(filterKey === s.key ? null : s.key)}
            className={clsx(
              'card flex flex-col items-start gap-1 text-left transition-colors',
              filterKey === s.key && 'ring-2 ring-sky-500',
              s.count === 0 && 'opacity-60',
            )}
          >
            <span className="text-[11px] uppercase tracking-wide text-slate-400">{s.label}</span>
            <span className={clsx('text-xl font-semibold tabular-nums', s.count === 0 ? 'text-emerald-400' : s.severity === 'error' ? 'text-rose-400' : 'text-amber-400')}>
              {s.count}
            </span>
          </button>
        ))}
      </div>

      <div
        className={clsx(
          'rounded-lg border px-4 py-3 text-sm',
          report.isClean ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-amber-800 bg-amber-950/30 text-amber-300',
        )}
      >
        {report.isClean
          ? 'No blocking data errors found. Warnings (if any) are informational — you can proceed to the dashboard.'
          : 'Some rows failed validation with errors. You can still proceed (affected trades will simply carry the values as parsed), but review the issues below first.'}
      </div>

      {report.issues.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            Issue Log {filterKey ? `— filtered` : `(${report.issues.length})`}
          </h2>
          <DataTable columns={columns} rows={filteredIssues} maxHeight={360} dense />
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button onClick={onReupload} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">
          Upload a different file
        </button>
        <button onClick={onProceed} className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500">
          Continue to Dashboard →
        </button>
      </div>
    </div>
  );
}
