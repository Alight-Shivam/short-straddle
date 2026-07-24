import { useMemo, useState } from 'react';
import type { Trade } from '../../types/trade';
import { DEFAULT_FILTERS, type FilterState } from '../../formulas/filters';
import { ChipToggleGroup } from '../ui/ChipToggleGroup';

interface Props {
  allTrades: Trade[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
  filteredCount: number;
}

const MONTHS = [
  { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' }, { value: 4, label: 'Apr' },
  { value: 5, label: 'May' }, { value: 6, label: 'Jun' }, { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' }, { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
];
const WEEKDAYS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' },
];

export function FiltersBar({ allTrades, filters, onChange, filteredCount }: Props) {
  const [open, setOpen] = useState(false);

  const years = useMemo(() => [...new Set(allTrades.map((t) => t.year))].sort((a, b) => a - b), [allTrades]);

  const activeCount = [
    filters.years.length, filters.months.length, filters.daysOfWeek.length, filters.entryTimeBuckets.length,
    filters.exitTimeBuckets.length, filters.strikeBuckets.length, filters.expiryBuckets.length,
    filters.exitReasons.length, filters.vixBuckets.length, filters.gapTypes.length, filters.trendTypes.length,
    filters.winLoss !== 'all' ? 1 : 0,
    filters.totalPremiumMin !== null || filters.totalPremiumMax !== null ? 1 : 0,
    filters.durationMinMinutes !== null || filters.durationMaxMinutes !== null ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) => onChange({ ...filters, [key]: value });

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m9 12h3.75M13.5 18a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0H10.5M3.75 12h9.75m9-6h.008v.008h-.008V6Zm0 12h.008v.008h-.008V18Z" />
          </svg>
          Filters {activeCount > 0 && <span className="rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{activeCount}</span>}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-200">{filteredCount}</span> / {allTrades.length} trades
          </span>
          {activeCount > 0 && (
            <button onClick={() => onChange(DEFAULT_FILTERS)} className="text-xs font-medium text-rose-400 hover:text-rose-300">
              Clear all
            </button>
          )}
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-slate-400 hover:text-slate-200">
            {open ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-800 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <ChipToggleGroup label="Year" options={years.map((y) => ({ value: y, label: String(y) }))} selected={filters.years} onChange={(v) => set('years', v)} />
          <ChipToggleGroup label="Month" options={MONTHS} selected={filters.months} onChange={(v) => set('months', v)} />
          <ChipToggleGroup label="Day of Week" options={WEEKDAYS} selected={filters.daysOfWeek} onChange={(v) => set('daysOfWeek', v)} />
          <ChipToggleGroup
            label="Win / Loss"
            options={[{ value: 'all', label: 'All' }, { value: 'win', label: 'Wins' }, { value: 'loss', label: 'Losses' }]}
            selected={[filters.winLoss]}
            onChange={(v) => set('winLoss', (v[v.length - 1] ?? 'all') as FilterState['winLoss'])}
          />
          <ChipToggleGroup
            label="Exit Reason"
            options={['SL Hit', 'Target Hit', 'Time Exit', 'Manual Exit'].map((v) => ({ value: v as FilterState['exitReasons'][number], label: v }))}
            selected={filters.exitReasons}
            onChange={(v) => set('exitReasons', v)}
          />
          <ChipToggleGroup
            label="Strike Type"
            options={['ATM', 'ITM', 'OTM (Strangle)'].map((v) => ({ value: v as FilterState['strikeBuckets'][number], label: v }))}
            selected={filters.strikeBuckets}
            onChange={(v) => set('strikeBuckets', v)}
          />
          <ChipToggleGroup
            label="Expiry"
            options={['Weekly Expiry', 'Monthly Expiry', 'Non Expiry'].map((v) => ({ value: v as FilterState['expiryBuckets'][number], label: v }))}
            selected={filters.expiryBuckets}
            onChange={(v) => set('expiryBuckets', v)}
          />
          <ChipToggleGroup
            label="VIX Regime"
            options={['Low VIX', 'Medium VIX', 'High VIX'].map((v) => ({ value: v as FilterState['vixBuckets'][number], label: v }))}
            selected={filters.vixBuckets}
            onChange={(v) => set('vixBuckets', v)}
          />
          <ChipToggleGroup
            label="Gap Type"
            options={['Gap Up', 'Gap Down', 'Flat Open'].map((v) => ({ value: v as FilterState['gapTypes'][number], label: v }))}
            selected={filters.gapTypes}
            onChange={(v) => set('gapTypes', v)}
          />
          <ChipToggleGroup
            label="Trend Type"
            options={['Trending', 'Range', 'Sideways'].map((v) => ({ value: v as FilterState['trendTypes'][number], label: v }))}
            selected={filters.trendTypes}
            onChange={(v) => set('trendTypes', v)}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total Premium Range (₹)</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.totalPremiumMin ?? ''}
                onChange={(e) => set('totalPremiumMin', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              />
              <span className="text-slate-500">–</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.totalPremiumMax ?? ''}
                onChange={(e) => set('totalPremiumMax', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Duration Range (minutes)</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.durationMinMinutes ?? ''}
                onChange={(e) => set('durationMinMinutes', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              />
              <span className="text-slate-500">–</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.durationMaxMinutes ?? ''}
                onChange={(e) => set('durationMaxMinutes', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
