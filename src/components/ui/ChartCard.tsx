import type { ReactNode } from 'react';

export function ChartCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`card ${className ?? ''}`}>
      <div className="mb-3">
        <h3 className="card-title !mb-0.5">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
