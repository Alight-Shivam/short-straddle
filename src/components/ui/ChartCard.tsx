import type { ReactNode } from 'react';

export function ChartCard({
  title,
  subtitle,
  children,
  className,
  isEmpty,
  emptyMessage = 'No data found for this range.',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  /** When true, shows `emptyMessage` instead of `children` — use for widgets with no underlying trades rather than letting a chart render blank. */
  isEmpty?: boolean;
  emptyMessage?: string;
}) {
  return (
    <div className={`card ${className ?? ''}`}>
      <div className="mb-3">
        <h3 className="card-title !mb-0.5">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {isEmpty ? <p className="py-8 text-center text-sm text-slate-500">{emptyMessage}</p> : children}
    </div>
  );
}
