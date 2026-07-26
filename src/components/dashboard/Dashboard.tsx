import { useMemo, useState } from 'react';
import type { Trade } from '../../types/trade';
import { runFullAnalysis } from '../../formulas';
import { applyFilters, DEFAULT_FILTERS, type FilterState } from '../../formulas/filters';
import { DEFAULT_STARTING_CAPITAL } from '../../formulas/analysis/capitalGrowth';
import { Header } from '../layout/Header';
import { FiltersBar } from './FiltersBar';
import { Tabs, type TabDef } from './Tabs';
import { OverviewSection } from './sections/OverviewSection';
import { TimeAnalysisSection } from './sections/TimeAnalysisSection';
import { EntryExitSection } from './sections/EntryExitSection';
import { OptionsSection } from './sections/OptionsSection';
import { MarketRegimeSection } from './sections/MarketRegimeSection';
import { DistributionSection } from './sections/DistributionSection';
import { CalendarSection } from './sections/CalendarSection';
import { TradeLogSection } from './sections/TradeLogSection';

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'time', label: 'Time Analysis' },
  { key: 'entryExit', label: 'Entry / Exit' },
  { key: 'options', label: 'Premium & Strike' },
  { key: 'regime', label: 'Volatility & Gap/Trend' },
  { key: 'distribution', label: 'Distribution & ROI' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'log', label: 'Trade Log' },
];

export function Dashboard({ trades, onReset }: { trades: Trade[]; onReset: () => void }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [startingCapital, setStartingCapital] = useState(DEFAULT_STARTING_CAPITAL);

  const filteredTrades = useMemo(() => applyFilters(trades, filters), [trades, filters]);
  const report = useMemo(() => runFullAnalysis(filteredTrades, { startingCapital }), [filteredTrades, startingCapital]);

  return (
    <div className="min-h-full">
      <Header tradeCount={trades.length} startingCapital={startingCapital} onStartingCapitalChange={setStartingCapital} onReset={onReset} />
      <main className="mx-auto flex max-w-[1400px] flex-col gap-5 px-6 py-5">
        <FiltersBar allTrades={trades} filters={filters} onChange={setFilters} filteredCount={filteredTrades.length} />
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {filteredTrades.length === 0 && trades.length > 0 && (
          <div className="card py-3 text-center text-sm text-slate-400">
            No trades match the current filters. Try clearing some filters — every widget below is showing "no data" for the same reason.
          </div>
        )}

        {activeTab === 'overview' && <OverviewSection report={report} />}
        {activeTab === 'time' && <TimeAnalysisSection report={report} />}
        {activeTab === 'entryExit' && <EntryExitSection report={report} />}
        {activeTab === 'options' && <OptionsSection report={report} />}
        {activeTab === 'regime' && <MarketRegimeSection report={report} />}
        {activeTab === 'distribution' && <DistributionSection report={report} />}
        {activeTab === 'calendar' && <CalendarSection report={report} />}
        {activeTab === 'log' && <TradeLogSection report={report} filteredTrades={filteredTrades} />}
      </main>
    </div>
  );
}
