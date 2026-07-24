import type { AnalysisReport } from '../../../formulas';
import { ChartCard } from '../../ui/ChartCard';
import { KpiCard } from '../../ui/KpiCard';
import { MultiBarChart } from '../../ui/charts';
import { formatCurrency, formatDate } from '../../../utils/format';

export function EntryExitSection({ report }: { report: AnalysisReport }) {
  const { entryTime, exitTime, duration, exitReason } = report;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Entry Time vs Win Rate / Profit" subtitle="Bucketed by 15-minute entry window">
          <MultiBarChart
            data={entryTime.map((b) => ({ bucket: b.bucket, 'Win Rate %': b.winRatePct, Profit: b.profit }))}
            xKey="bucket"
            series={[{ dataKey: 'Profit', name: 'Profit (₹)' }]}
          />
        </ChartCard>
        <ChartCard title="Exit Time — Profit by Bucket">
          <MultiBarChart
            data={exitTime.buckets.map((b) => ({ bucket: b.bucket, Profit: b.profit }))}
            xKey="bucket"
            series={[{ dataKey: 'Profit', name: 'Profit (₹)' }]}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard
          label="Maximum Profit Trade"
          value={formatCurrency(exitTime.maxProfitTrade?.pnl ?? 0)}
          tone="good"
          sub={exitTime.maxProfitTrade ? `${formatDate(exitTime.maxProfitTrade.entryDate)} · exit ${exitTime.maxProfitTrade.exitTime}` : undefined}
        />
        <KpiCard
          label="Maximum Loss Trade"
          value={formatCurrency(exitTime.maxLossTrade?.pnl ?? 0)}
          tone="bad"
          sub={exitTime.maxLossTrade ? `${formatDate(exitTime.maxLossTrade.entryDate)} · exit ${exitTime.maxLossTrade.exitTime}` : undefined}
        />
      </div>

      <ChartCard title="Exit Reason Breakdown" subtitle="Heuristic classification — see formulas/analysis/exitReason.ts">
        <MultiBarChart
          data={exitReason.map((r) => ({ reason: r.reason, Trades: r.totalTrades, Profit: r.profit }))}
          xKey="reason"
          series={[{ dataKey: 'Profit', name: 'Profit (₹)' }]}
        />
      </ChartCard>

      <ChartCard title="Trade Duration Analysis">
        <MultiBarChart
          data={duration.map((d) => ({ bucket: d.bucket, Trades: d.totalTrades, Profit: d.profit }))}
          xKey="bucket"
          series={[{ dataKey: 'Profit', name: 'Profit (₹)' }]}
        />
      </ChartCard>
    </div>
  );
}
