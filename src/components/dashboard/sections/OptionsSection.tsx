import type { AnalysisReport } from '../../../formulas';
import { ChartCard } from '../../ui/ChartCard';
import { MultiBarChart } from '../../ui/charts';
import { formatCurrency, formatPct } from '../../../utils/format';
import { CE_COLOR, PE_COLOR } from '../../../utils/colors';

export function OptionsSection({ report }: { report: AnalysisReport }) {
  const isEmpty = report.overview.totalTrades === 0;
  const { premiumRanges, strike, cePe, premiumDecay } = report;

  return (
    <div className="flex flex-col gap-5">
      <ChartCard isEmpty={isEmpty} title="Entry Premium Range vs Profit" subtitle="Combined CE+PE entry premium">
        <MultiBarChart
          data={premiumRanges.map((r) => ({ range: r.range, Profit: r.profit, Trades: r.totalTrades }))}
          xKey="range"
          series={[{ dataKey: 'Profit', name: 'Profit (₹)' }]}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard isEmpty={isEmpty} title="Strike Analysis (ATM / ITM / OTM)">
          <MultiBarChart
            data={strike.map((s) => ({ bucket: s.bucket, Profit: s.profit, Trades: s.totalTrades }))}
            xKey="bucket"
            series={[{ dataKey: 'Profit', name: 'Profit (₹)' }]}
          />
        </ChartCard>

        <ChartCard isEmpty={isEmpty} title="CE vs PE — Contribution">
          <MultiBarChart
            data={[
              { side: 'CE', Profit: cePe.ce.totalPnl, 'Avg Decay %': cePe.ce.averageDecayPct },
              { side: 'PE', Profit: cePe.pe.totalPnl, 'Avg Decay %': cePe.pe.averageDecayPct },
            ]}
            xKey="side"
            series={[
              { dataKey: 'Profit', name: 'Total P/L (₹)', color: CE_COLOR },
            ]}
          />
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-800 p-3" style={{ borderColor: CE_COLOR }}>
              <p className="font-semibold" style={{ color: CE_COLOR }}>CE Legs</p>
              <p className="mt-1 text-slate-400">Total P/L: <span className="text-slate-200">{formatCurrency(cePe.ce.totalPnl)}</span></p>
              <p className="text-slate-400">Avg Entry Premium: <span className="text-slate-200">{formatCurrency(cePe.ce.averageEntryPremium)}</span></p>
              <p className="text-slate-400">Avg Decay: <span className="text-slate-200">{formatPct(cePe.ce.averageDecayPct)}</span></p>
              <p className="text-slate-400">Win/Loss legs: <span className="text-slate-200">{cePe.ce.winningLegs}/{cePe.ce.losingLegs}</span></p>
            </div>
            <div className="rounded-lg border border-slate-800 p-3" style={{ borderColor: PE_COLOR }}>
              <p className="font-semibold" style={{ color: PE_COLOR }}>PE Legs</p>
              <p className="mt-1 text-slate-400">Total P/L: <span className="text-slate-200">{formatCurrency(cePe.pe.totalPnl)}</span></p>
              <p className="text-slate-400">Avg Entry Premium: <span className="text-slate-200">{formatCurrency(cePe.pe.averageEntryPremium)}</span></p>
              <p className="text-slate-400">Avg Decay: <span className="text-slate-200">{formatPct(cePe.pe.averageDecayPct)}</span></p>
              <p className="text-slate-400">Win/Loss legs: <span className="text-slate-200">{cePe.pe.winningLegs}/{cePe.pe.losingLegs}</span></p>
            </div>
          </div>
        </ChartCard>
      </div>

      <ChartCard isEmpty={isEmpty} title="Premium Decay % Buckets" subtitle="(entry premium − exit premium) / entry premium">
        <MultiBarChart
          data={premiumDecay.map((d) => ({ bucket: d.bucket, Trades: d.totalTrades, Profit: d.profit }))}
          xKey="bucket"
          series={[{ dataKey: 'Profit', name: 'Profit (₹)' }]}
        />
      </ChartCard>
    </div>
  );
}
