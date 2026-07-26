import type { AnalysisReport } from '../../../formulas';
import { KpiCard } from '../../ui/KpiCard';
import { ChartCard } from '../../ui/ChartCard';
import { DrawdownAreaChart, EquityAreaChart, WinLossPie } from '../../ui/charts';
import { formatCurrency, formatNumber, formatPct } from '../../../utils/format';

export function OverviewSection({ report }: { report: AnalysisReport }) {
  const { overview, riskMetrics, drawdown, streaks, capitalGrowth } = report;
  const roiPct = capitalGrowth.length ? capitalGrowth[capitalGrowth.length - 1].cumulativeReturnPct : 0;
  const currentCapital = capitalGrowth.length ? capitalGrowth[capitalGrowth.length - 1].capital : 0;

  const equityData = report.equityCurve.daily.map((p) => ({ date: p.key, equity: p.cumulativePnl }));
  const ddData = drawdown.series.map((p) => ({ date: p.key, drawdown: -p.drawdown }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Net Profit" value={formatCurrency(overview.netProfit)} tone={overview.netProfit >= 0 ? 'good' : 'bad'} />
        <KpiCard label="ROI" value={formatPct(roiPct)} sub={`Capital: ${formatCurrency(currentCapital)}`} tone={roiPct >= 0 ? 'good' : 'bad'} />
        <KpiCard label="Total Trades" value={formatNumber(overview.totalTrades)} sub={`${overview.winningTrades}W / ${overview.losingTrades}L`} />
        <KpiCard label="Win Rate" value={formatPct(overview.winRatePct)} tone={overview.winRatePct >= 50 ? 'good' : 'bad'} />
        <KpiCard label="Profit Factor" value={overview.profitFactor.toFixed(2)} tone={overview.profitFactor >= 1 ? 'good' : 'bad'} />
        <KpiCard label="Max Drawdown" value={formatCurrency(drawdown.maxDrawdown)} sub={formatPct(drawdown.maxDrawdownPct)} tone="bad" />
        <KpiCard label="Expectancy / Trade" value={formatCurrency(overview.expectancy)} tone={overview.expectancy >= 0 ? 'good' : 'bad'} />
        <KpiCard label="Recovery Factor" value={overview.recoveryFactor.toFixed(2)} />
        <KpiCard label="Average RR" value={overview.averageRR.toFixed(2)} />
        <KpiCard label="Max Win / Loss Streak" value={`${overview.maxConsecutiveWins} / ${overview.maxConsecutiveLosses}`} />
      </div>

      <div>
        <h3 className="card-title">Risk-Adjusted Performance</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Sharpe Ratio" value={riskMetrics.sharpeRatio.toFixed(2)} sub="Annualized, 0% risk-free" tone={riskMetrics.sharpeRatio >= 1 ? 'good' : riskMetrics.sharpeRatio < 0 ? 'bad' : 'neutral'} />
          <KpiCard label="Sortino Ratio" value={riskMetrics.sortinoRatio.toFixed(2)} sub="Downside deviation only" tone={riskMetrics.sortinoRatio >= 1 ? 'good' : riskMetrics.sortinoRatio < 0 ? 'bad' : 'neutral'} />
          <KpiCard label="Calmar Ratio" value={Number.isFinite(riskMetrics.calmarRatio) ? riskMetrics.calmarRatio.toFixed(2) : '∞'} sub="CAGR ÷ Max Drawdown %" tone={riskMetrics.calmarRatio >= 1 ? 'good' : riskMetrics.calmarRatio < 0 ? 'bad' : 'neutral'} />
          <KpiCard label="Ulcer Index" value={riskMetrics.ulcerIndex.toFixed(2)} sub="Lower is smoother equity" tone={riskMetrics.ulcerIndex <= 5 ? 'good' : 'bad'} />
          <KpiCard label="CAGR" value={formatPct(riskMetrics.cagrPct)} sub="Annualized (or total if <1yr)" tone={riskMetrics.cagrPct >= 0 ? 'good' : 'bad'} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          MFE/MAE (Maximum Favorable/Adverse Excursion) aren't shown yet — they need the intraday price path during each trade's
          holding window, which neither a CSV upload nor an Upstox trade-sync currently provides.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ChartCard title="Equity Curve (Daily, Cumulative)" className="lg:col-span-2">
          <EquityAreaChart data={equityData} xKey="date" dataKey="equity" />
        </ChartCard>
        <ChartCard title="Win / Loss Split">
          <WinLossPie wins={overview.winningTrades} losses={overview.losingTrades} scratches={overview.scratchTrades} />
        </ChartCard>
      </div>

      <ChartCard title="Drawdown Curve" subtitle={`Longest: ${drawdown.longestDrawdownDays}d · Avg recovery: ${drawdown.averageRecoveryDays}d · Episodes: ${drawdown.drawdownFrequency}`}>
        <DrawdownAreaChart data={ddData} xKey="date" dataKey="drawdown" />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <ChartCard title="Overall Performance Detail">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[
              ['Gross Profit', formatCurrency(overview.grossProfit)],
              ['Gross Loss', formatCurrency(overview.grossLoss)],
              ['Average Profit', formatCurrency(overview.averageProfit)],
              ['Average Loss', formatCurrency(overview.averageLoss)],
              ['Largest Profit', formatCurrency(overview.largestProfit)],
              ['Largest Loss', formatCurrency(overview.largestLoss)],
              ['Loss Rate', formatPct(overview.lossRatePct)],
              ['Scratch Trades', formatNumber(overview.scratchTrades)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-slate-800/60 py-1">
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-medium tabular-nums text-slate-200">{value}</dd>
              </div>
            ))}
          </dl>
        </ChartCard>
        <ChartCard title="Streaks">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[
              ['Longest Winning Streak', `${streaks.longestWinningStreak?.length ?? 0} trades`],
              ['Longest Losing Streak', `${streaks.longestLosingStreak?.length ?? 0} trades`],
              ['Avg Win Streak Length', streaks.averageWinStreak.toFixed(2)],
              ['Avg Loss Streak Length', streaks.averageLossStreak.toFixed(2)],
              ['Best Streak P/L', formatCurrency(streaks.longestWinningStreak?.pnl ?? 0)],
              ['Worst Streak P/L', formatCurrency(streaks.longestLosingStreak?.pnl ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-slate-800/60 py-1">
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-medium tabular-nums text-slate-200">{value}</dd>
              </div>
            ))}
          </dl>
        </ChartCard>
      </div>
    </div>
  );
}
