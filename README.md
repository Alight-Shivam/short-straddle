# Short Straddle Backtest Analyzer

A dashboard for a short-straddle options strategy with two ways to get data
in — sync live from Upstox, or upload a CSV — feeding one shared validation
and analytics engine.

```
short-straddle/
  src/            React + Vite frontend (this is the "app")
  server/         Express backend — ONLY exists to hold Upstox OAuth secrets
                  and proxy Upstox API calls; see server/README.md
```

## Getting started

```bash
npm install                       # frontend deps
npm --prefix server install       # backend deps
cp .env.example .env              # frontend: points at the backend
cp server/.env.example server/.env  # backend: your Upstox app credentials

npm run dev:all    # runs both (frontend :5173, backend :4000)
# or separately: npm run dev   /   npm run dev:server
```

The backend is only required for the "Connect to Upstox" / "Sync from
Upstox" / "Live Market" features — CSV upload works with just the frontend
running. See `server/README.md` for getting Upstox API credentials and
deployment instructions.

```bash
npm run build    # type-check + production build (frontend)
npm run lint     # oxlint
```

## How it works

1. **Get data in**, two ways:
   - **Sync from Upstox** (primary path) — connect your account once (OAuth,
     re-required daily since Upstox tokens expire at 3:30 AM IST) and pull
     your own executed F&O trades from the last 3 years directly into the
     analyzer. See `server/src/upstox/tradeSync.ts` for exactly how raw
     fills get reconstructed into trades, and its documented limitations
     (no execution timestamp, no VIX — Entry/Exit Time and Volatility
     analysis won't be meaningful for synced data).
   - **Upload a CSV** (secondary path) matching the required template
     (download it from the upload screen, or see `src/formulas/csvSchema.ts`).
     Each trading day is one parent row (whole-number `Index`) followed by
     its CE/PE leg rows (`Index` = `N.1`, `N.2`).
2. **Stage 1 — Validation**: every trade (from either source) is checked for
   duplicates, missing values, bad times/strikes, negative prices, P&L
   consistency, etc. Errors and warnings are listed with the exact trade
   they came from. You can still proceed to the dashboard with warnings.
3. **Stage 2 — Dashboard**: 25 analysis sections (overview KPIs, equity
   curve, drawdown, year/month/day breakdowns, entry/exit time, premium &
   strike analysis, CE vs PE, decay, volatility, gap/trend, exit-reason,
   duration, distribution, streaks, capital growth, rolling performance,
   best/worst trades, calendar heatmap, ROI) — all filterable from the
   **Stage 3** filter bar (year, month, day, win/loss, exit reason, VIX
   regime, gap/trend type, strike type, premium range, duration range, …).
4. **Live Market** (separate tab, needs Upstox connected): real-time NIFTY/
   BANKNIFTY/FINNIFTY/MIDCPNIFTY option chain — OI, IV, Greeks, chain-wide
   PCR, Max Pain — plus a live "sell this straddle now" expiry-day payoff
   chart for whichever strike you click. Independent of the backtest
   dashboard; doesn't touch your CSV/synced trade data.

## Where the formulas live

**Every calculation and validation rule lives in `src/formulas/**` and
nowhere else.** If a number on the dashboard looks wrong, or you want to
change a threshold/assumption, that folder is the single place to look —
see `src/formulas/README.md` for the full map and the ground rules
(pure functions, documented assumptions, no UI code). This now includes
`src/formulas/liveMarket/` (PCR, Max Pain, IV skew, live straddle payoff) for
the Live Market tab, alongside the original backtest-analysis modules.

A few metrics in the spec (Gap Up/Down, Trend regime, Expiry-day
classification, SL/Target/Manual exit reason) aren't literally present as
columns in the CSV — those files document the heuristic/proxy used and
expose the tunable constants at the top of the file. Every constant that
encodes a real exchange rule (expiry weekday, strike step, VIX bands) was
checked against current NSE/broker conventions — see the "Verified against
Indian market conventions" section in `src/formulas/README.md` for exactly
what was confirmed and when.
