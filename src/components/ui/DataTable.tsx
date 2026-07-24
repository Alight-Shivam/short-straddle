import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => ReactNode;
}

export function DataTable<T>({ columns, rows, dense, maxHeight }: { columns: Column<T>[]; rows: T[]; dense?: boolean; maxHeight?: number }) {
  return (
    <div className="overflow-auto rounded-lg border border-slate-800" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-900 text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={clsx('border-b border-slate-800 px-3 font-medium', dense ? 'py-1.5' : 'py-2', {
                'text-right': c.align === 'right',
                'text-center': c.align === 'center',
                'text-left': !c.align || c.align === 'left',
              })}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">
                No data for the current filters.
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={i} className="odd:bg-slate-900/30 hover:bg-slate-800/40">
              {columns.map((c) => (
                <td key={c.key} className={clsx('border-b border-slate-800/60 px-3 tabular-nums', dense ? 'py-1.5' : 'py-2', {
                  'text-right': c.align === 'right',
                  'text-center': c.align === 'center',
                })}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
