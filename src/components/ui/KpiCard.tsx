import type { ReactNode } from 'react';
import clsx from 'clsx';

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'good' | 'bad';
  icon?: ReactNode;
}

export function KpiCard({ label, value, sub, tone = 'neutral', icon }: KpiCardProps) {
  return (
    <div className="card flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
        {icon}
      </div>
      <span
        className={clsx('text-2xl font-semibold tabular-nums', {
          'text-emerald-400': tone === 'good',
          'text-rose-400': tone === 'bad',
          'text-slate-100': tone === 'neutral',
        })}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}
