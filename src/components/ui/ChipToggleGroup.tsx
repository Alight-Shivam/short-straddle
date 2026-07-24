import clsx from 'clsx';

interface ChipToggleGroupProps<T extends string | number> {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
}

export function ChipToggleGroup<T extends string | number>({ label, options, selected, onChange }: ChipToggleGroupProps<T>) {
  const toggle = (v: T) => {
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => toggle(opt.value)}
            className={clsx(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              selected.includes(opt.value)
                ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
