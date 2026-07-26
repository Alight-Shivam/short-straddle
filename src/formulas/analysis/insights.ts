import type { AnalysisReport } from '../index';

/**
 * 26. Rule-based AI Insights — deliberately NOT an LLM. Every insight here is
 * a plain threshold/comparison rule over fields the other 25 analysis
 * modules already computed; nothing new is inferred or fetched. An
 * LLM-backed version is a distinct, later, opt-in phase (new API key, cost,
 * non-determinism) — same pattern as the Upstox OAuth approval earlier in
 * this project. Keeping insights rule-based means every claim here is
 * exactly traceable to a number already on the dashboard.
 */

export type InsightSeverity = 'positive' | 'warning' | 'negative' | 'neutral';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
}

/** Buckets with fewer trades than this are skipped for "best/worst X" comparisons — too small a sample to mean anything. */
const MIN_SAMPLE_SIZE = 3;

const SEVERITY_ORDER: Record<InsightSeverity, number> = { negative: 0, warning: 1, positive: 2, neutral: 3 };

interface BucketStats {
  totalTrades: number;
  profit: number;
  winRatePct: number;
  averagePnl: number;
}

/** Shared helper for the many `{bucket/day/month/...}Stats[]` shapes that all carry totalTrades/profit/winRatePct/averagePnl — finds the best and worst by averagePnl among buckets with enough trades to trust. */
function bestAndWorst<T extends BucketStats>(stats: T[]): { best: T | null; worst: T | null } {
  const eligible = stats.filter((s) => s.totalTrades >= MIN_SAMPLE_SIZE);
  if (eligible.length < 2) return { best: null, worst: null };
  const sorted = [...eligible].sort((a, b) => b.averagePnl - a.averagePnl);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

export function generateInsights(report: Omit<AnalysisReport, 'insights'>): Insight[] {
  const insights: Insight[] = [];
  const { overview, riskMetrics, drawdown, dayWise, monthWise, expiryDay, volatility, gapTrend, exitReason, strike, cePe, premiumDecay, duration, streaks, rolling } = report;

  if (overview.totalTrades === 0) return [];

  // ---- Overall profitability ----
  if (overview.netProfit > 0 && overview.profitFactor >= 1.5) {
    insights.push({ id: 'profitability', severity: 'positive', title: 'Solid overall profitability', message: `Net profit is positive with a profit factor of ${overview.profitFactor.toFixed(2)} — gross wins comfortably outweigh gross losses.` });
  } else if (overview.netProfit > 0) {
    insights.push({ id: 'profitability', severity: 'warning', title: 'Profitable, but with thin margins', message: `Net profit is positive but the profit factor is only ${overview.profitFactor.toFixed(2)} — a run of losses could erase the edge quickly.` });
  } else {
    insights.push({ id: 'profitability', severity: 'negative', title: 'Overall unprofitable', message: `Net P/L is ${overview.netProfit.toFixed(0)} across ${overview.totalTrades} trades — the strategy is losing money over this dataset.` });
  }

  // ---- Win rate vs reward:risk ----
  if (overview.winRatePct >= 60 && overview.averageRR >= 0.5) {
    insights.push({ id: 'win-rate', severity: 'positive', title: 'High win rate', message: `${overview.winRatePct.toFixed(1)}% of trades win, with an average win/loss ratio of ${overview.averageRR.toFixed(2)}.` });
  } else if (overview.winRatePct < 40) {
    insights.push({ id: 'win-rate', severity: 'warning', title: 'Low win rate', message: `Only ${overview.winRatePct.toFixed(1)}% of trades win — check whether average wins (${overview.averageProfit.toFixed(0)}) are large enough relative to average losses (${overview.averageLoss.toFixed(0)}) to still be worthwhile.` });
  }

  // ---- Risk-adjusted return ----
  if (riskMetrics.sharpeRatio >= 1) {
    insights.push({ id: 'sharpe', severity: 'positive', title: 'Strong risk-adjusted returns', message: `Sharpe ratio of ${riskMetrics.sharpeRatio.toFixed(2)} — returns are well compensated for their volatility.` });
  } else if (riskMetrics.sharpeRatio < 0) {
    insights.push({ id: 'sharpe', severity: 'negative', title: 'Negative risk-adjusted returns', message: `Sharpe ratio of ${riskMetrics.sharpeRatio.toFixed(2)} — on average, the daily P/L volatility isn't being compensated by returns.` });
  }

  // ---- Drawdown ----
  if (drawdown.maxDrawdownPct >= 50) {
    insights.push({ id: 'drawdown', severity: 'negative', title: 'Severe drawdown', message: `Max drawdown reached ${drawdown.maxDrawdownPct.toFixed(1)}% of capital, over ${drawdown.longestDrawdownDays} days — a large capital swing to sit through.` });
  } else if (drawdown.maxDrawdownPct >= 25) {
    insights.push({ id: 'drawdown', severity: 'warning', title: 'Notable drawdown', message: `Max drawdown was ${drawdown.maxDrawdownPct.toFixed(1)}% of capital. Longest recovery took ${drawdown.longestDrawdownDays} days.` });
  }

  // ---- Best/worst day of week ----
  const dayBW = bestAndWorst(dayWise);
  if (dayBW.best && dayBW.worst && dayBW.best.dayName !== dayBW.worst.dayName) {
    insights.push({ id: 'day-of-week', severity: 'neutral', title: 'Day-of-week skew', message: `${dayBW.best.dayName} is the strongest entry day (avg ${dayBW.best.averagePnl.toFixed(0)}/trade), ${dayBW.worst.dayName} the weakest (avg ${dayBW.worst.averagePnl.toFixed(0)}/trade).` });
  }

  // ---- Best/worst month ----
  const monthBW = bestAndWorst(monthWise);
  if (monthBW.best && monthBW.worst && monthBW.best.monthName !== monthBW.worst.monthName) {
    insights.push({ id: 'month', severity: 'neutral', title: 'Seasonal skew', message: `${monthBW.best.monthName} has historically been the strongest month (avg ${monthBW.best.averagePnl.toFixed(0)}/trade), ${monthBW.worst.monthName} the weakest (avg ${monthBW.worst.averagePnl.toFixed(0)}/trade).` });
  }

  // ---- Expiry-day comparison ----
  const expiryBW = bestAndWorst(expiryDay);
  if (expiryBW.best && expiryBW.worst && expiryBW.best.bucket !== expiryBW.worst.bucket) {
    insights.push({ id: 'expiry-day', severity: 'neutral', title: 'Expiry-type skew', message: `${expiryBW.best.bucket} trades average ${expiryBW.best.averagePnl.toFixed(0)}/trade vs ${expiryBW.worst.averagePnl.toFixed(0)} for ${expiryBW.worst.bucket}.` });
  }

  // ---- VIX regime ----
  const vixBW = bestAndWorst(volatility);
  if (vixBW.worst && vixBW.worst.bucket === 'High VIX' && vixBW.worst.averagePnl < 0) {
    insights.push({ id: 'vix-regime', severity: 'warning', title: 'High-VIX trades underperform', message: `Trades entered during High VIX (${vixBW.worst.range}) average ${vixBW.worst.averagePnl.toFixed(0)}/trade — a common short-straddle risk, since volatility spikes hurt short premium the most.` });
  } else if (vixBW.best && vixBW.worst && vixBW.best.bucket !== vixBW.worst.bucket) {
    insights.push({ id: 'vix-regime', severity: 'neutral', title: 'VIX-regime skew', message: `${vixBW.best.bucket} trades average ${vixBW.best.averagePnl.toFixed(0)}/trade, the best of the three VIX bands; ${vixBW.worst.bucket} the weakest at ${vixBW.worst.averagePnl.toFixed(0)}.` });
  }

  // ---- Gap type (skipped if the dataset doesn't have enough neighbouring-day data to classify confidently) ----
  if (!gapTrend.insufficientDataNote) {
    const gapBW = bestAndWorst(gapTrend.gap);
    if (gapBW.best && gapBW.worst && gapBW.best.gapType !== gapBW.worst.gapType) {
      insights.push({ id: 'gap-type', severity: 'neutral', title: 'Gap-type skew', message: `${gapBW.best.gapType} days average ${gapBW.best.averagePnl.toFixed(0)}/trade vs ${gapBW.worst.averagePnl.toFixed(0)} on ${gapBW.worst.gapType} days.` });
    }
  }

  // ---- Exit reason ----
  const dominantExit = [...exitReason].sort((a, b) => b.totalTrades - a.totalTrades)[0];
  if (dominantExit && dominantExit.totalTrades >= MIN_SAMPLE_SIZE && dominantExit.reason === 'SL Hit' && dominantExit.averagePnl < 0) {
    insights.push({ id: 'exit-reason', severity: 'warning', title: 'Most exits are stop-loss hits', message: `${dominantExit.totalTrades} of ${overview.totalTrades} trades (${((dominantExit.totalTrades / overview.totalTrades) * 100).toFixed(0)}%) exit via SL Hit, averaging ${dominantExit.averagePnl.toFixed(0)}/trade — worth reviewing entry timing or stop placement.` });
  }

  // ---- Strike bucket (ATM/ITM/OTM) ----
  const strikeBW = bestAndWorst(strike);
  if (strikeBW.best && strikeBW.worst && strikeBW.best.bucket !== strikeBW.worst.bucket) {
    insights.push({ id: 'strike-bucket', severity: 'neutral', title: 'Strike-selection skew', message: `${strikeBW.best.bucket} trades average ${strikeBW.best.averagePnl.toFixed(0)}/trade, best of the three; ${strikeBW.worst.bucket} average ${strikeBW.worst.averagePnl.toFixed(0)}.` });
  }

  // ---- CE vs PE leg asymmetry ----
  const ceVsPe = cePe.ce.averagePnl - cePe.pe.averagePnl;
  if (Math.abs(ceVsPe) > 0 && (cePe.ce.totalPnl !== 0 || cePe.pe.totalPnl !== 0)) {
    const stronger = ceVsPe > 0 ? 'CE' : 'PE';
    const weaker = stronger === 'CE' ? 'PE' : 'CE';
    const strongerStats = stronger === 'CE' ? cePe.ce : cePe.pe;
    const weakerStats = stronger === 'CE' ? cePe.pe : cePe.ce;
    if (Math.abs(strongerStats.averagePnl - weakerStats.averagePnl) >= Math.abs(strongerStats.averagePnl) * 0.2) {
      insights.push({ id: 'ce-pe-asymmetry', severity: 'neutral', title: `${stronger} leg outperforms ${weaker}`, message: `${stronger} legs average ${strongerStats.averagePnl.toFixed(0)}/leg vs ${weakerStats.averagePnl.toFixed(0)} for ${weaker} — the straddle's edge isn't symmetric between the two sides.` });
    }
  }

  // ---- Premium decay ----
  const decayBW = bestAndWorst(premiumDecay);
  if (decayBW.best && decayBW.worst && decayBW.best.bucket !== decayBW.worst.bucket) {
    insights.push({ id: 'premium-decay', severity: 'neutral', title: 'Decay-stage skew', message: `Trades exited around ${decayBW.best.bucket} decay average ${decayBW.best.averagePnl.toFixed(0)}/trade, the best band; ${decayBW.worst.bucket} decay averages ${decayBW.worst.averagePnl.toFixed(0)}.` });
  }

  // ---- Holding duration ----
  const durationBW = bestAndWorst(duration);
  if (durationBW.best && durationBW.worst && durationBW.best.bucket !== durationBW.worst.bucket) {
    insights.push({ id: 'duration', severity: 'neutral', title: 'Holding-duration skew', message: `Trades held for ${durationBW.best.bucket} average ${durationBW.best.averagePnl.toFixed(0)}/trade, the best band; ${durationBW.worst.bucket} holds average ${durationBW.worst.averagePnl.toFixed(0)}.` });
  }

  // ---- Losing streaks ----
  if (streaks.longestLosingStreak && streaks.longestLosingStreak.length >= 5) {
    insights.push({ id: 'losing-streak', severity: 'warning', title: 'Long losing streak on record', message: `The longest losing streak ran ${streaks.longestLosingStreak.length} trades in a row (${streaks.longestLosingStreak.pnl.toFixed(0)} total) — worth having a plan for sitting through a streak that long again.` });
  }

  // ---- Recent trend (shortest vs longest available rolling window) ----
  if (rolling.length >= 2) {
    const sortedWindows = [...rolling].sort((a, b) => a.windowDays - b.windowDays);
    const recent = sortedWindows[0];
    const long = sortedWindows[sortedWindows.length - 1];
    if (recent.totalTrades >= MIN_SAMPLE_SIZE && long.totalTrades >= MIN_SAMPLE_SIZE) {
      const recentAvg = recent.netProfit / recent.totalTrades;
      const longAvg = long.netProfit / long.totalTrades;
      if (recentAvg < longAvg * 0.5 && longAvg > 0) {
        insights.push({ id: 'recent-trend', severity: 'warning', title: 'Recent performance has cooled', message: `The last ${recent.windowDays} days average ${recentAvg.toFixed(0)}/trade vs ${longAvg.toFixed(0)}/trade over the last ${long.windowDays} days.` });
      } else if (recentAvg > longAvg * 1.5 && recentAvg > 0) {
        insights.push({ id: 'recent-trend', severity: 'positive', title: 'Recent performance has improved', message: `The last ${recent.windowDays} days average ${recentAvg.toFixed(0)}/trade vs ${longAvg.toFixed(0)}/trade over the last ${long.windowDays} days.` });
      }
    }
  }

  return insights.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
