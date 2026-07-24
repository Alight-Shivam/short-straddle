# Short Straddle Backtest Analyzer

A React + Vite dashboard that ingests a short-straddle strategy trade log
(CSV), validates it, and runs a full performance-analytics suite with
filterable charts and tables.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run lint      # oxlint
```

## How it works

1. **Upload** a CSV matching the required template (download it from the
   upload screen, or see `src/formulas/csvSchema.ts`). Each trading day is one
   parent row (whole-number `Index`) followed by its CE/PE leg rows
   (`Index` = `N.1`, `N.2`).
2. **Stage 1 — Validation**: the file is checked for duplicates, missing
   values, bad times/strikes, negative prices, P&L consistency, etc. Errors
   and warnings are listed with the exact trade/row they came from. You can
   still proceed to the dashboard with warnings.
3. **Stage 2 — Dashboard**: 25 analysis sections (overview KPIs, equity
   curve, drawdown, year/month/day breakdowns, entry/exit time, premium &
   strike analysis, CE vs PE, decay, volatility, gap/trend, exit-reason,
   duration, distribution, streaks, capital growth, rolling performance,
   best/worst trades, calendar heatmap, ROI) — all filterable from the
   **Stage 3** filter bar (year, month, day, win/loss, exit reason, VIX
   regime, gap/trend type, strike type, premium range, duration range, …).

## Where the formulas live

**Every calculation and validation rule lives in `src/formulas/**` and
nowhere else.** If a number on the dashboard looks wrong, or you want to
change a threshold/assumption, that folder is the single place to look —
see `src/formulas/README.md` for the full map and the ground rules
(pure functions, documented assumptions, no UI code).

A few metrics in the spec (Gap Up/Down, Trend regime, Expiry-day
classification, SL/Target/Manual exit reason) aren't literally present as
columns in the CSV — those files document the heuristic/proxy used and
expose the tunable constants at the top of the file.
