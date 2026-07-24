# Formulas & Validation — Single Source of Truth

Every calculation, rule and heuristic used by the dashboard lives **only** in
this folder. Nothing outside `src/formulas/**` should re-implement a metric —
UI components only call functions exported from here and render the result.

When a formula needs to change (a bug fix, a new rule, a different
assumption), this is the **only** place you need to edit.

## Layout

```
formulas/
  csvSchema.ts        Canonical CSV column list + template generator (Stage 0)
  parseTrades.ts       Raw CSV rows -> Trade[] (groups parent + CE/PE legs)
  validation/
    rules.ts           Stage 1 — Data Validation checks
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
