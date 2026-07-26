import { useMemo } from 'react';
import type { AnalysisReport } from '../../../formulas';
import { ChartCard } from '../../ui/ChartCard';
import { divergingColor } from '../../ui/heatmapColor';
import { formatCurrency } from '../../../utils/format';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function monthGrid(year: number, month: number, cellsByDay: Map<number, { pnl: number; tradeCount: number }>) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const cells: { day: number | null; pnl?: number; tradeCount?: number }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const entry = cellsByDay.get(d);
    cells.push({ day: d, pnl: entry?.pnl, tradeCount: entry?.tradeCount });
  }
  return cells;
}

export function CalendarSection({ report }: { report: AnalysisReport }) {
  const isEmpty = report.overview.totalTrades === 0;
  const byYearMonth = useMemo(() => {
    const map = new Map<string, Map<number, { pnl: number; tradeCount: number }>>();
    for (const day of report.calendar) {
      const key = `${day.date.getFullYear()}-${day.date.getMonth() + 1}`;
      if (!map.has(key)) map.set(key, new Map());
      map.get(key)!.set(day.date.getDate(), { pnl: day.pnl, tradeCount: day.tradeCount });
    }
    return map;
  }, [report.calendar]);

  const maxAbs = Math.max(1, ...report.calendar.map((d) => Math.abs(d.pnl)));
  const monthKeys = [...byYearMonth.keys()].sort();

  return (
    <div className="flex flex-col gap-5">
      <ChartCard isEmpty={isEmpty} title="Trade Calendar" subtitle="Green = profitable day, red = loss day. Hover a cell for details.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {monthKeys.map((key) => {
            const [year, month] = key.split('-').map(Number);
            const cells = monthGrid(year, month, byYearMonth.get(key)!);
            const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            return (
              <div key={key} className="rounded-lg border border-slate-800 p-2">
                <p className="mb-1.5 text-xs font-semibold text-slate-300">{monthName}</p>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAY_LABELS.map((w, i) => (
                    <span key={i} className="text-center text-[9px] text-slate-600">{w}</span>
                  ))}
                  {cells.map((c, i) => (
                    <div
                      key={i}
                      title={c.day && c.pnl !== undefined ? `${monthName.split(' ')[0]} ${c.day}: ${formatCurrency(c.pnl)} (${c.tradeCount} trades)` : undefined}
                      className="aspect-square rounded text-center text-[9px] leading-[1.6]"
                      style={{
                        background: c.day === null ? 'transparent' : c.pnl !== undefined ? divergingColor(c.pnl, maxAbs) : 'var(--color-slate-800)',
                        color: c.pnl !== undefined ? 'rgba(255,255,255,0.9)' : 'var(--color-slate-600)',
                      }}
                    >
                      {c.day ?? ''}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}
