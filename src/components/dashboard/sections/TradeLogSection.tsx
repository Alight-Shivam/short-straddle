import type { AnalysisReport } from '../../../formulas';
import type { Trade } from '../../../types/trade';
import { ChartCard } from '../../ui/ChartCard';
import { DataTable, type Column } from '../../ui/DataTable';
import { formatCurrency, formatDate } from '../../../utils/format';
import { classifyExitReason } from '../../../formulas/analysis/exitReason';

function tradeColumns(): Column<Trade>[] {
  return [
    { key: 'id', label: 'ID', render: (t) => t.id },
    { key: 'date', label: 'Date', render: (t) => formatDate(t.entryDate) },
    { key: 'day', label: 'Day', render: (t) => t.dayName.slice(0, 3) },
    { key: 'entry', label: 'Entry', render: (t) => t.entryTime },
    { key: 'exit', label: 'Exit', render: (t) => t.exitTime },
    { key: 'ce', label: 'CE Strike', align: 'right', render: (t) => t.ce?.strike ?? '—' },
    { key: 'pe', label: 'PE Strike', align: 'right', render: (t) => t.pe?.strike ?? '—' },
    { key: 'premium', label: 'Entry Premium', align: 'right', render: (t) => (t.entryPremiumTotal !== null ? formatCurrency(t.entryPremiumTotal) : '—') },
    { key: 'vix', label: 'VIX', align: 'right', render: (t) => t.vix ?? '—' },
    { key: 'reason', label: 'Exit Reason', render: (t) => classifyExitReason(t) },
    { key: 'pnl', label: 'P/L', align: 'right', render: (t) => <span className={t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatCurrency(t.pnl)}</span> },
  ];
}

export function TradeLogSection({ report, filteredTrades }: { report: AnalysisReport; filteredTrades: Trade[] }) {
  const cols = tradeColumns();

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Top 20 Winners">
          <DataTable columns={cols} rows={report.bestTrades} maxHeight={420} dense />
        </ChartCard>
        <ChartCard title="Top 20 Losers">
          <DataTable columns={cols} rows={report.worstTrades} maxHeight={420} dense />
        </ChartCard>
      </div>

      <ChartCard title="Full Trade Log" subtitle="Reflects active filters">
        <DataTable columns={cols} rows={filteredTrades} maxHeight={520} dense />
      </ChartCard>
    </div>
  );
}
