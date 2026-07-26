import type { AnalysisReport } from '../index';

/**
 * 27. Rule-based Natural Language Query Engine — templated pattern matching
 * over a fixed intent list, NOT an LLM. Every answer is read straight off an
 * already-computed `AnalysisReport` field; nothing is generated or inferred
 * beyond picking which field to report. An LLM-backed free-form version is a
 * distinct, later, opt-in phase (new API key, cost, non-determinism) — same
 * split as `insights.ts`. Intents are tried in order; the first pattern
 * match wins, so more specific patterns are listed before broader ones.
 */

export interface QueryAnswer {
  matched: boolean;
  intentId?: string;
  answer: string;
}

interface Intent {
  id: string;
  patterns: RegExp[];
  handle: (report: AnalysisReport) => string;
}

function bestBy<T extends { averagePnl: number; totalTrades: number }>(stats: T[]): T | null {
  const eligible = stats.filter((s) => s.totalTrades >= 3);
  return eligible.length ? [...eligible].sort((a, b) => b.averagePnl - a.averagePnl)[0] : null;
}
function worstBy<T extends { averagePnl: number; totalTrades: number }>(stats: T[]): T | null {
  const eligible = stats.filter((s) => s.totalTrades >= 3);
  return eligible.length ? [...eligible].sort((a, b) => a.averagePnl - b.averagePnl)[0] : null;
}

const INTENTS: Intent[] = [
  {
    id: 'win-rate',
    patterns: [/win\s*rate/i, /how many.*(win|wins)/i],
    handle: (r) => `Win rate is ${r.overview.winRatePct.toFixed(1)}% (${r.overview.winningTrades} wins / ${r.overview.losingTrades} losses / ${r.overview.scratchTrades} scratches out of ${r.overview.totalTrades} trades).`,
  },
  {
    id: 'net-profit',
    patterns: [/net\s*profit/i, /total\s*profit/i, /how much.*(made|profit|money)/i],
    handle: (r) => `Net profit is ${r.overview.netProfit.toFixed(0)} across ${r.overview.totalTrades} trades (gross profit ${r.overview.grossProfit.toFixed(0)}, gross loss ${r.overview.grossLoss.toFixed(0)}).`,
  },
  {
    id: 'profit-factor',
    patterns: [/profit\s*factor/i],
    handle: (r) => `Profit factor is ${r.overview.profitFactor.toFixed(2)} (gross profit ÷ |gross loss|).`,
  },
  {
    id: 'expectancy',
    patterns: [/expectancy/i, /average.*(pnl|p\/l|profit per trade)/i],
    handle: (r) => `Expectancy is ${r.overview.expectancy.toFixed(0)} per trade on average.`,
  },
  {
    id: 'sharpe',
    patterns: [/sharpe/i],
    handle: (r) => `Sharpe ratio is ${r.riskMetrics.sharpeRatio.toFixed(2)} (annualized, 0% risk-free rate).`,
  },
  {
    id: 'sortino',
    patterns: [/sortino/i],
    handle: (r) => `Sortino ratio is ${r.riskMetrics.sortinoRatio.toFixed(2)} (downside deviation only).`,
  },
  {
    id: 'calmar',
    patterns: [/calmar/i],
    handle: (r) => (Number.isFinite(r.riskMetrics.calmarRatio) ? `Calmar ratio is ${r.riskMetrics.calmarRatio.toFixed(2)} (CAGR ÷ max drawdown %).` : 'Calmar ratio is undefined (no drawdown recorded yet).'),
  },
  {
    id: 'drawdown',
    patterns: [/draw\s*down/i],
    handle: (r) => `Max drawdown is ${r.drawdown.maxDrawdown.toFixed(0)} (${r.drawdown.maxDrawdownPct.toFixed(1)}% of capital), lasting ${r.drawdown.longestDrawdownDays} days at its longest, across ${r.drawdown.drawdownFrequency} drawdown episode(s).`,
  },
  {
    id: 'best-day',
    patterns: [/best\s*day/i, /which day.*(best|most profit)/i],
    handle: (r) => { const b = bestBy(r.dayWise); return b ? `${b.dayName} is the best-performing day of the week, averaging ${b.averagePnl.toFixed(0)}/trade over ${b.totalTrades} trades.` : 'Not enough trades per weekday yet to say.'; },
  },
  {
    id: 'worst-day',
    patterns: [/worst\s*day/i, /which day.*(worst|least profit|losing)/i],
    handle: (r) => { const w = worstBy(r.dayWise); return w ? `${w.dayName} is the weakest day of the week, averaging ${w.averagePnl.toFixed(0)}/trade over ${w.totalTrades} trades.` : 'Not enough trades per weekday yet to say.'; },
  },
  {
    id: 'best-month',
    patterns: [/best\s*month/i],
    handle: (r) => { const b = bestBy(r.monthWise); return b ? `${b.monthName} is historically the strongest month, averaging ${b.averagePnl.toFixed(0)}/trade over ${b.totalTrades} trades.` : 'Not enough trades per month yet to say.'; },
  },
  {
    id: 'worst-month',
    patterns: [/worst\s*month/i],
    handle: (r) => { const w = worstBy(r.monthWise); return w ? `${w.monthName} is historically the weakest month, averaging ${w.averagePnl.toFixed(0)}/trade over ${w.totalTrades} trades.` : 'Not enough trades per month yet to say.'; },
  },
  {
    id: 'weekly-vs-monthly-expiry',
    patterns: [/weekly.*(vs|versus|compare).*monthly/i, /monthly.*(vs|versus|compare).*weekly/i, /expiry/i],
    handle: (r) => r.expiryDay.map((e) => `${e.bucket}: ${e.averagePnl.toFixed(0)}/trade avg (${e.totalTrades} trades, ${e.winRatePct.toFixed(0)}% win rate)`).join('. ') || 'No expiry-bucketed data yet.',
  },
  {
    id: 'vix',
    patterns: [/vix/i, /volatilit/i],
    handle: (r) => r.volatility.map((v) => `${v.bucket} (${v.range}): ${v.averagePnl.toFixed(0)}/trade avg (${v.totalTrades} trades)`).join('. ') || 'No VIX data on synced/uploaded trades.',
  },
  {
    id: 'ce-vs-pe',
    patterns: [/call.*put|put.*call|ce.*pe|pe.*ce/i],
    handle: (r) => `CE legs: ${r.cePe.ce.averagePnl.toFixed(0)}/leg avg, ${r.cePe.ce.averageDecayPct.toFixed(1)}% avg decay. PE legs: ${r.cePe.pe.averagePnl.toFixed(0)}/leg avg, ${r.cePe.pe.averageDecayPct.toFixed(1)}% avg decay.`,
  },
  {
    id: 'exit-reason',
    patterns: [/exit\s*reason/i, /stop\s*loss|sl hit/i, /target\s*hit/i],
    handle: (r) => r.exitReason.filter((e) => e.totalTrades > 0).map((e) => `${e.reason}: ${e.totalTrades} trades, ${e.averagePnl.toFixed(0)}/trade avg`).join('. ') || 'No exit-reason data yet.',
  },
  {
    id: 'strike-bucket',
    patterns: [/\batm\b|\bitm\b|\botm\b|strangle/i, /strike.*(bucket|type|selection)/i],
    handle: (r) => r.strike.filter((s) => s.totalTrades > 0).map((s) => `${s.bucket}: ${s.averagePnl.toFixed(0)}/trade avg (${s.totalTrades} trades)`).join('. ') || 'No strike-bucket data yet.',
  },
  {
    id: 'streak',
    patterns: [/streak/i],
    handle: (r) => {
      const w = r.streaks.longestWinningStreak;
      const l = r.streaks.longestLosingStreak;
      return `Longest winning streak: ${w?.length ?? 0} trades (${(w?.pnl ?? 0).toFixed(0)}). Longest losing streak: ${l?.length ?? 0} trades (${(l?.pnl ?? 0).toFixed(0)}).`;
    },
  },
  {
    id: 'best-trade',
    patterns: [/best\s*trade/i, /biggest\s*win/i, /largest\s*profit/i],
    handle: (r) => (r.bestTrades[0] ? `Best single trade: ${r.bestTrades[0].id}, P/L ${r.bestTrades[0].pnl.toFixed(0)} on ${new Date(r.bestTrades[0].entryDate).toLocaleDateString('en-IN')}.` : 'No trades yet.'),
  },
  {
    id: 'worst-trade',
    patterns: [/worst\s*trade/i, /biggest\s*loss/i, /largest\s*loss/i],
    handle: (r) => (r.worstTrades[0] ? `Worst single trade: ${r.worstTrades[0].id}, P/L ${r.worstTrades[0].pnl.toFixed(0)} on ${new Date(r.worstTrades[0].entryDate).toLocaleDateString('en-IN')}.` : 'No trades yet.'),
  },
  {
    id: 'total-trades',
    patterns: [/how many trades|total trades|number of trades/i],
    handle: (r) => `${r.overview.totalTrades} trades total.`,
  },
  {
    id: 'duration',
    patterns: [/duration|holding time|how long.*(held|hold)/i],
    handle: (r) => bestBy(r.duration) ? `${bestBy(r.duration)!.bucket} holds perform best, averaging ${bestBy(r.duration)!.averagePnl.toFixed(0)}/trade.` : 'Not enough duration-bucketed data yet.',
  },
];

const FALLBACK = "I don't have a rule for that yet. Try asking about: win rate, net profit, profit factor, Sharpe/Sortino/Calmar, drawdown, best/worst day or month, weekly vs monthly expiry, VIX regime, CE vs PE, exit reason, ATM/ITM/OTM, streaks, best/worst trade, or duration.";

/** Rule-based query answering — matches `query` against a fixed intent list and reads the answer off `report`. Returns `matched: false` (with a helpful list of what IS supported) rather than guessing when nothing matches. */
export function answerQuery(report: AnalysisReport, query: string): QueryAnswer {
  const trimmed = query.trim();
  if (!trimmed) return { matched: false, answer: 'Ask a question about your trades — e.g. "what is my win rate" or "best day of week".' };
  if (report.overview.totalTrades === 0) return { matched: false, answer: 'No trades loaded yet.' };

  for (const intent of INTENTS) {
    if (intent.patterns.some((p) => p.test(trimmed))) {
      return { matched: true, intentId: intent.id, answer: intent.handle(report) };
    }
  }
  return { matched: false, answer: FALLBACK };
}
