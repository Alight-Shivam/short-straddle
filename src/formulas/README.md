# Formulas & Validation — Single Source of Truth

Every calculation, rule and heuristic used by the dashboard lives **only** in
this folder. Nothing outside `src/formulas/**` should re-implement a metric —
UI components only call functions exported from here and render the result.

When a formula needs to change (a bug fix, a new rule, a different
assumption), this is the **only** place you need to edit.

## Layout

```
formulas/
  csvSchema.ts        Canonical CSV column list + template generator (Stage 0).
                      Pure/isomorphic (no `document`/`Blob`) — safe to import
                      from the Node backend too.
  buildTrade.ts        Shared "derived fields" step (isWin, durationMinutes,
                       dayName, entryPremiumTotal, …) — used by BOTH
                       parseTrades.ts (CSV) and server/src/upstox/tradeSync.ts
                       (Upstox sync), so a trade scores identically either way.
  parseTrades.ts       Raw CSV rows -> Trade[] (groups parent + CE/PE legs)
  filters.ts           Stage 3 — dashboard filter predicates over Trade[]
  validation/
    rules.ts           Stage 1 — Data Validation checks (shared `validateTrades`
                       used by both the CSV and Upstox-sync entry points)
  liveMarket/           Live-market analytics for the Upstox-backed "Live
                       Market" tab (independent of the backtest engine above):
    pcr.ts               Put-Call Ratio + per-strike OI buildup table
    maxPain.ts           Max Pain strike + full pain curve
    ivMetrics.ts         ATM IV + IV skew across strikes (NOT IV Rank/
                       Percentile — that needs stored history, see the note
                       in the file)
    straddlePayoff.ts    Expiry-day payoff curve for "sell this straddle now"
    expiryCalendar.ts    Nearest/weekly/monthly expiry date resolution (reuses
                       analysis/expiryDay.ts's weekday schedule) — the
                       "Automatic Expiry" piece of the Historical Data Engine
    strikeResolver.ts    ATM / ATM±N / closest-premium / closest-delta strike
                       search against a chain snapshot — the "Automatic
                       Strike Search" piece, and what the future Strategy
                       Optimizer will grid-search over
  analysis/
    overview.ts         1. Overall performance KPIs
    equityCurve.ts       2. Daily/Weekly/Monthly/Yearly equity curves
    drawdown.ts          3. Drawdown analysis
    yearWise.ts          4. Year-wise breakdown
    monthWise.ts         5. Month-wise breakdown + heatmap
    dayWise.ts           6. Day-of-week breakdown
    expiryDay.ts         7. Weekly / Monthly / Non-expiry breakdown
    entryTime.ts         8. Entry-time buckets vs win rate / profit
    exitTime.ts          9. Exit-time buckets, max profit/loss
    premium.ts          10. Entry premium range buckets
    strike.ts           11. ATM / ITM / OTM classification
    cePe.ts              12. CE vs PE contribution + decay
    premiumDecay.ts      13. Premium decay % buckets (10%-90%)
    volatility.ts        14. VIX regime buckets
    gapTrend.ts          15/16. Gap-up/down/flat + trend regime (heuristic)
    exitReason.ts        17. SL hit / target hit / time exit (heuristic)
    duration.ts          18. Trade duration buckets
    distribution.ts      19. Histogram / profit & loss distribution
    streaks.ts           20. Consecutive win/loss streaks
    capitalGrowth.ts     21. Compounded equity from a starting capital
    rolling.ts           22. Rolling 30/60/90/180/365 day performance
    bestWorst.ts         23. Top winners / losers
    calendar.ts          24. Calendar heatmap data
    roi.ts               25. Monthly / quarterly / yearly ROI
    riskMetrics.ts       26. Sharpe / Sortino / Calmar / Ulcer Index (MFE/MAE
                       deliberately null — need intraday price history that
                       doesn't exist yet, see the note in the file)
    insights.ts          27. Rule-based AI Insights — plain threshold/
                       comparison rules over the other 25 modules' output,
                       NOT an LLM. Every claim traces to a number already
                       elsewhere on the dashboard.
    nlQuery.ts           28. Rule-based NL Query Engine — templated pattern
                       matching over a fixed intent list (also not an LLM);
                       answers are read straight off `AnalysisReport`.
  index.ts              runFullAnalysis(trades, options) — orchestrates all of
                         the above into one `AnalysisReport` consumed by the UI
```

## Design rules

1. **Pure functions only.** Every exported function takes `Trade[]` (already
   parsed & validated) plus plain option objects, and returns plain data
   (numbers/arrays/objects). No React, no DOM, no I/O.
2. **Documented assumptions.** Where the source CSV doesn't literally contain
   a field the spec asks for (e.g. Gap Up/Down needs a spot price, Trend
   analysis needs OHLC, Expiry day needs an expiry-date column), the function
   says so in a `NOTE:` doc-comment, states the heuristic/proxy used, and
   exposes any tunable constant at the top of the file so it's a single edit
   to adjust later.
3. **Never mutate input.** All functions treat `Trade[]` as read-only.
4. **One responsibility per file.** If you need a new metric, add a function
   to the relevant file (or a new file) rather than growing a god-module.

## Verified against Indian market conventions (July 2026)

Every constant in this folder that encodes a real exchange rule was checked
against current NSE circulars/broker documentation, not assumed. Notable
findings from that pass:

- **Expiry weekday is not constant.** NSE ran Thursday expiry for NIFTY/
  BANKNIFTY from inception, then moved to Tuesday effective 2025-09-02 (a
  March-2025 circular proposing Monday, effective 2025-04-04, was withdrawn
  before taking effect — deliberately not modeled). `expiryDay.ts` uses a
  dated schedule (`EXPIRY_WEEKDAY_SCHEDULE`) rather than a single weekday
  constant, so a dataset spanning the cutover classifies correctly on both
  sides.
- **Strike step is a moving target too.** 50 pts is the long-standing default;
  100 pts is BANKNIFTY's standard and was also used for far NIFTY strikes;
  25 pts was introduced for monthly/quarterly NIFTY strikes on 2025-11-17.
  `validation/rules.ts` allow-lists all three rather than picking one.
- **India VIX bands**: retuned to the commonly-cited <15 / 15-20 / >20 split
  (was <15/15-25) to match standard retail/broker interpretation.
- **Lot size** is deliberately never hardcoded anywhere — `Qty` in the CSV is
  the actual traded quantity, so repeated SEBI-mandated lot-size revisions
  (BANKNIFTY alone changed 3 times in the 2024-2025 window) can't desync the
  math.
- **Not modeled yet, flagged for a future pass**: transaction costs (STT on
  options sell + on exercise, exchange/SEBI charges, stamp duty, brokerage,
  GST) are not subtracted anywhere, so all P&L in this app is *gross*. STT on
  options was hiked to 0.15% of premium (both on sell and on exercise)
  effective the FY2026-27 Budget — material enough on a high-frequency
  short-straddle log that a "net of costs" toggle is worth adding (see
  `capitalGrowth.ts` / `overview.ts` as the two places a cost model would
  plug in).
