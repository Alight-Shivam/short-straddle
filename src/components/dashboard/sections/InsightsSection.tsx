import { useState } from 'react';
import clsx from 'clsx';
import type { AnalysisReport } from '../../../formulas';
import type { InsightSeverity } from '../../../formulas/analysis/insights';
import { answerQuery, type QueryAnswer } from '../../../formulas/analysis/nlQuery';
import { ChartCard } from '../../ui/ChartCard';

const SEVERITY_STYLES: Record<InsightSeverity, string> = {
  positive: 'border-emerald-800 bg-emerald-950/40',
  warning: 'border-amber-800 bg-amber-950/30',
  negative: 'border-rose-800 bg-rose-950/40',
  neutral: 'border-slate-700 bg-slate-900/40',
};
const SEVERITY_LABEL_STYLES: Record<InsightSeverity, string> = {
  positive: 'text-emerald-300',
  warning: 'text-amber-300',
  negative: 'text-rose-300',
  neutral: 'text-slate-300',
};

const EXAMPLE_QUERIES = ['win rate', 'best day of week', 'sharpe ratio', 'weekly vs monthly expiry', 'ce vs pe', 'longest losing streak'];

export function InsightsSection({ report }: { report: AnalysisReport }) {
  const isEmpty = report.overview.totalTrades === 0;
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<QueryAnswer | null>(null);

  const ask = (q: string) => {
    setQuery(q);
    setAnswer(answerQuery(report, q));
  };

  return (
    <div className="flex flex-col gap-5">
      <ChartCard
        title="AI Insights"
        subtitle="Rule-based observations over your stats above — every claim here is a plain threshold/comparison on numbers already on this dashboard, not an LLM guess."
        isEmpty={isEmpty}
      >
        {report.insights.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No notable patterns yet — insights need a few trades per bucket (day/month/etc.) to trust a comparison.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {report.insights.map((insight) => (
              <div key={insight.id} className={clsx('rounded-lg border p-3', SEVERITY_STYLES[insight.severity])}>
                <p className={clsx('text-xs font-semibold uppercase tracking-wide', SEVERITY_LABEL_STYLES[insight.severity])}>{insight.title}</p>
                <p className="mt-1 text-sm text-slate-300">{insight.message}</p>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="Ask about your trades"
        subtitle="Templated matching over a fixed set of questions — not a free-form LLM. If it doesn't recognize the question, it says so and lists what it does support."
        isEmpty={isEmpty}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(query);
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "what is my win rate" or "best day of week"'
            className="min-w-64 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200"
          />
          <button type="submit" className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-500">
            Ask
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLE_QUERIES.map((q) => (
            <button key={q} onClick={() => ask(q)} className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200">
              {q}
            </button>
          ))}
        </div>

        {answer && (
          <div className={clsx('mt-3 rounded-lg border p-3 text-sm', answer.matched ? 'border-sky-900/60 bg-sky-950/20 text-slate-200' : 'border-slate-700 bg-slate-900/40 text-slate-400')}>
            {answer.answer}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
