import type { AnalysisReport } from '../../../formulas';
import { ChartCard } from '../../ui/ChartCard';
import { EquityAreaChart, MultiBarChart } from '../../ui/charts';
import { DataTable, type Column } from '../../ui/DataTable';
import { formatCurrency, formatPct } from '../../../utils/format';
import type { RollingWindowStats } from '../../../formulas/analysis/rolling';
import type { RoiPoint } from '../../../formulas/analysis/roi';

export function DistributionSection({ report }: { report: AnalysisReport }) {
  const { distribution, rolling, roi, capitalGrowth } = report;

  const rollingCols: Column<RollingWindowStats>[] = [
    { key: 'window', label: 'Window', render: (r) => `${r.windowDays}D` },
    { key: 'trades', label: 'Trades', align: 'right', render: (r) => r.totalTrades },
    { key: 'profit', label: 'Net Profit', align: 'right', render: (r) => <span className={r.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatCurrency(r.netProfit)}</span> },
    { key: 'winRate', label: 'Win Rate', align: 'right', render: (r) => formatPct(r.winRatePct) },
  ];

  const roiCols: Column<RoiPoint>[] = [
    { key: 'period', label: 'Period', render: (r) => r.key },
    { key: 'profit', label: 'Profit', align: 'right', render: (r) => <span className={r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatCurrency(r.profit)}</span> },
    { key: 'roi', label: 'ROI %', align: 'right', render: (r) => formatPct(r.roiPct) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <ChartCard title="Capital Growth" subtitle="Starting capital + cumulative P/L (fixed lot sizing, not compounded)">
        <EquityAreaChart data={capitalGrowth.map((p) => ({ trade: p.key, capital: p.capital }))} xKey="trade" dataKey="capital" height={240} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ChartCard title="P/L Distribution" subtitle={`Mean ${formatCurrency(distribution.mean)} · StdDev ${formatCurrency(distribution.stdDev)}`}>
          <MultiBarChart data={distribution.histogram.map((b) => ({ range: b.rangeLabel, Count: b.count }))} xKey="range" series={[{ dataKey: 'Count', name: 'Trades' }]} height={220} />
        </ChartCard>
        <ChartCard title="Profit Distribution">
          <MultiBarChart data={distribution.profitHistogram.map((b) => ({ range: b.rangeLabel, Count: b.count }))} xKey="range" series={[{ dataKey: 'Count', name: 'Wins' }]} height={220} />
        </ChartCard>
        <ChartCard title="Loss Distribution">
          <MultiBarChart data={distribution.lossHistogram.map((b) => ({ range: b.rangeLabel, Count: b.count }))} xKey="range" series={[{ dataKey: 'Count', name: 'Losses' }]} height={220} />
        </ChartCard>
      </div>

      <ChartCard title="Rolling Performance">
        <DataTable columns={rollingCols} rows={rolling} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ChartCard title="Monthly ROI"><DataTable columns={roiCols} rows={roi.monthly} maxHeight={320} dense /></ChartCard>
        <ChartCard title="Quarterly ROI"><DataTable columns={roiCols} rows={roi.quarterly} maxHeight={320} dense /></ChartCard>
        <ChartCard title="Yearly ROI"><DataTable columns={roiCols} rows={roi.yearly} maxHeight={320} dense /></ChartCard>
      </div>
    </div>
  );
}
