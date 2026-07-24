import { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import { downloadTemplateCsv, CSV_COLUMNS, CSV_COLUMN_DESCRIPTIONS } from '../../formulas/csvSchema';

interface FileUploadProps {
  onFile: (file: File) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export function FileUpload({ onFile, isLoading, errorMessage }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
          Upload your strategy trade log CSV to get full validation, performance analytics, and a filterable dashboard.
        </p>
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
          onClick={() => downloadTemplateCsv()}
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
