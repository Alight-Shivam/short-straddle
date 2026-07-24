import clsx from 'clsx';

export interface TabDef {
  key: string;
  label: string;
}

export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-px">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={clsx(
            'rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors',
            active === t.key ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
