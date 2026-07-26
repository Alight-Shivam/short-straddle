import type { AnalysisReport } from '../../../formulas';
import { ChartCard } from '../../ui/ChartCard';
import { MultiBarChart, PnlBarChart } from '../../ui/charts';
import { DataTable, type Column } from '../../ui/DataTable';
import { formatCurrency, formatPct } from '../../../utils/format';
import { divergingColor } from '../../ui/heatmapColor';
import type { YearStats } from '../../../formulas/analysis/yearWise';

export function TimeAnalysisSection({ report }: { report: AnalysisReport }) {
  const isEmpty = report.overview.totalTrades === 0;
  const yearCols: Column<YearStats>[] = [
    { key: 'year', label: 'Year', render: (r) => r.year },
    { key: 'trades', label: 'Trades', align: 'right', render: (r) => r.totalTrades },
    { key: 'profit', label: 'Profit', align: 'right', render: (r) => <span className={r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatCurrency(r.profit)}</span> },
    { key: 'winRate', label: 'Win Rate', align: 'right', render: (r) => formatPct(r.winRatePct) },
    { key: 'avgProfit', label: 'Avg Profit', align: 'right', render: (r) => formatCurrency(r.averageProfit) },
    { key: 'avgLoss', label: 'Avg Loss', align: 'right', render: (r) => formatCurrency(r.averageLoss) },
    { key: 'dd', label: 'Max Drawdown', align: 'right', render: (r) => formatCurrency(r.maxDrawdown) },
    { key: 'roi', label: 'ROI', align: 'right', render: (r) => formatPct(r.roiPct) },
  ];

  const heatmapYears = [...new Set(report.monthlyHeatmap.map((c) => c.year))].sort();
  const maxAbsMonthly = Math.max(1, ...report.monthlyHeatmap.map((c) => Math.abs(c.profit)));

  return (
    <div className="flex flex-col gap-5">
      <ChartCard isEmpty={isEmpty} title="Year Wise — Profit">
        <PnlBarChart data={report.yearWise.map((y) => ({ year: String(y.year), profit: y.profit }))} xKey="year" dataKey="profit" />
      </ChartCard>
      <ChartCard isEmpty={isEmpty} title="Year Wise — Detail">
        <DataTable columns={yearCols} rows={report.yearWise} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard isEmpty={isEmpty} title="Month Wise — Seasonality (all years combined)">
          <MultiBarChart
            data={report.monthWise.map((m) => ({ month: m.monthName.slice(0, 3), Profit: m.profit }))}
            xKey="month"
            series={[{ dataKey: 'Profit', name: 'Profit' }]}
          />
        </ChartCard>
        <ChartCard isEmpty={isEmpty} title="Day of Week">
          <MultiBarChart
            data={report.dayWise.map((d) => ({ day: d.dayName.slice(0, 3), Profit: d.profit }))}
            xKey="day"
            series={[{ dataKey: 'Profit', name: 'Profit' }]}
          />
        </ChartCard>
      </div>

      <ChartCard isEmpty={isEmpty} title="Monthly Heatmap" subtitle="Profit by calendar month, green = profit, red = loss">
        <div className="overflow-auto">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="text-left text-slate-500">Year</th>
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => (
                  <th key={m} className="px-1 text-slate-500">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapYears.map((year) => (
                <tr key={year}>
                  <td className="pr-2 font-medium text-slate-400">{year}</td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                    const cell = report.monthlyHeatmap.find((c) => c.year === year && c.month === month);
                    return (
                      <td key={month} className="rounded" style={{ background: cell ? divergingColor(cell.profit, maxAbsMonthly) : 'transparent', minWidth: 44, height: 32 }} title={cell ? `${formatCurrency(cell.profit)} (${cell.totalTrades} trades)` : ''}>
                        {cell && <span className="block text-center text-[10px] text-white/90">{Math.round(cell.profit / 1000)}k</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <ChartCard isEmpty={isEmpty} title="Expiry Day Analysis" subtitle="Heuristic — see formulas/analysis/expiryDay.ts">
        <MultiBarChart
          data={report.expiryDay.map((e) => ({ bucket: e.bucket, Profit: e.profit }))}
          xKey="bucket"
          series={[{ dataKey: 'Profit', name: 'Profit' }]}
        />
      </ChartCard>
    </div>
  );
}
