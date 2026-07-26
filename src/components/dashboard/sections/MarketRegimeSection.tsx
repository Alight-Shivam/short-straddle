import type { AnalysisReport } from '../../../formulas';
import { ChartCard } from '../../ui/ChartCard';
import { MultiBarChart } from '../../ui/charts';

export function MarketRegimeSection({ report }: { report: AnalysisReport }) {
  const isEmpty = report.overview.totalTrades === 0;
  const { volatility, gapTrend } = report;

  return (
    <div className="flex flex-col gap-5">
      <ChartCard isEmpty={isEmpty} title="Volatility (VIX) Regime">
        <MultiBarChart
          data={volatility.map((v) => ({ bucket: `${v.bucket} (${v.range})`, Profit: v.profit, Trades: v.totalTrades }))}
          xKey="bucket"
          series={[{ dataKey: 'Profit', name: 'Profit (₹)' }]}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard isEmpty={isEmpty} title="Gap Analysis" subtitle="Heuristic: ATM strike used as spot proxy — see formulas/analysis/gapTrend.ts">
          <MultiBarChart
            data={gapTrend.gap.map((g) => ({ bucket: g.gapType, Profit: g.profit, Trades: g.totalTrades }))}
            xKey="bucket"
            series={[{ dataKey: 'Profit', name: 'Profit (₹)' }]}
          />
        </ChartCard>
        <ChartCard isEmpty={isEmpty} title="Trend Analysis" subtitle={gapTrend.insufficientDataNote}>
          <MultiBarChart
            data={gapTrend.trend.map((t) => ({ bucket: t.trendType, Profit: t.profit, Trades: t.totalTrades }))}
            xKey="bucket"
            series={[{ dataKey: 'Profit', name: 'Profit (₹)' }]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
