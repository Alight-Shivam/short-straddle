# short-straddle-server

The backend half of the Upstox integration. It exists for one reason: Upstox's
OAuth token exchange needs a `client_secret` that must never reach the
browser, so something server-side has to hold it and make the actual calls.
This service does three things:

1. **Auth** — runs the OAuth2 dance with Upstox and keeps the resulting
   access token in a server-side session (never sent to the frontend).
2. **Market data proxy** — option chain, quotes, historical candles, expiry/
   strike resolution, all authenticated with the session's token (except
   `/expiry`, which is pure calendar math and needs no session at all).
3. **Trade sync** — pulls the logged-in user's own executed F&O trades from
   Upstox and reshapes them into this app's `Trade[]` model (see
   `src/upstox/tradeSync.ts` — read the caveats at the top of that file
   before trusting synced data the same way you'd trust a CSV upload).

### Market data routes (`server/src/routes/market.ts`)

| Route | Auth? | What |
|---|---|---|
| `GET /expiry` | No | Nearest/weekly/monthly expiry date for a symbol — pure date math, reuses the same NSE expiry-weekday schedule (`src/formulas/analysis/expiryDay.ts`) the backtest engine classifies past trades with. |
| `GET /option-chain` | Yes | Live option-chain snapshot (OI/IV/Greeks/LTP per strike), cached 3s server-side to de-dupe near-simultaneous requests. |
| `GET /quote` | Yes | LTP for one or more instrument keys. |
| `GET /historical-candle` | Yes | Raw OHLC+volume+OI candles for any instrument key, cached 5min. |
| `GET /historical-spot` | Yes | Convenience wrapper over `/historical-candle` — resolves a shorthand index symbol (NIFTY, BANKNIFTY, …) to its instrument key for you. |
| `GET /historical-option` | Yes | Same, for a specific option contract — get its `instrument_key` from `/option-chain` first. Only works for contracts that haven't expired yet (see limitations below). |
| `GET /strike` | Yes | "Automatic Strike Search" — resolves ATM / ATM±N / closest-premium / closest-delta against the live chain. See `src/formulas/liveMarket/strikeResolver.ts`. |
| `GET /expired-option-contracts` | Yes | Unchanged from before — still flagged as Upstox-Plus-plan-only. |
| `GET /live-tick` | Yes | "Live Tick Engine" — polls the LTP endpoint (rate-limited to once/3s per instrument server-side) and builds 1m/5m/15m candles in memory. See `src/liveTick/tickEngine.ts` for why this is polling, not a push WebSocket. |

**No database yet, by design (current roadmap phase):** `/option-chain` and
the `/historical-*` routes are backed by a tiny in-memory TTL cache
(`src/cache/memoryCache.ts`), not persistent storage. That means every server
restart starts cold, and nothing here scales past a single instance — this is
an intentional, temporary tradeoff (see the project-root roadmap doc) rather
than an oversight. It's enough to avoid hammering Upstox with duplicate
requests within a session; it is not a substitute for the DuckDB-backed
persistence layer planned for later.

**Two things the client's spec asks for that Upstox genuinely does not
provide, at any plan tier** — don't build features that assume these exist:
- **Historical Implied Volatility.** Upstox's historical-candle response is
  OHLC + volume + OI only; IV only ever appears in the *live* option-chain
  snapshot. The only way to get an IV history is to capture snapshots
  yourself over time (the future DB/live-tick-storage phase), not to fetch it
  from Upstox after the fact.
- **A true historical option-chain snapshot** (e.g. "show me the full chain
  as it looked on 2026-03-15"). Upstox's `/option/chain` endpoint is always
  *current* state — there's no time-travel parameter. What's currently
  buildable is: replay historical OHLC candles per strike for contracts whose
  expiry *hasn't happened yet* (via `/historical-option`); reconstructing a
  chain for an *already-expired* series needs the paid Expired Instruments
  tier. Neither of these is "the chain as it looked at time X," only an
  after-the-fact OHLC approximation.

## Local setup

```bash
cd server
npm install
cp .env.example .env   # then fill in the Upstox values below
npm run dev            # http://localhost:4000
```

Or from the repo root, `npm run dev:all` starts this **and** the Vite
frontend together.

### Getting Upstox credentials

1. Go to <https://developer.upstox.com/> (requires a regular Upstox trading
   account) → create an app.
2. Set the app's **Redirect URI** to exactly `http://localhost:4000/api/auth/callback`
   for local dev (must match `UPSTOX_REDIRECT_URI` in `.env` byte-for-byte,
   including http vs https and any trailing slash).
3. Copy the app's Client ID / Client Secret into `server/.env`.
4. The API itself is free (confirmed July 2026) — you only pay ₹10/order if
   you *place trades* through it, which this app never does. Note that the
   "Expired Instruments" endpoints (used only by
   `getExpiredOptionContracts`, which nothing else here depends on) sit
   behind Upstox's paid "Upstox Plus" plan — don't build on that function
   without checking your plan first.

### Known Upstox constraints worth knowing before you rely on this

- **Access tokens expire at 03:30 IST every day**, no matter when they were
  issued, and there's no refresh-token flow — the user has to click
  "Connect to Upstox" again each trading day. `GET /api/auth/status` reports
  this so the frontend can prompt proactively instead of waiting for a 401.
- **Trade-sync has no execution timestamp**, only a trade date — see the
  doc-comment in `src/upstox/tradeSync.ts`. Entry/Exit Time analysis and
  Volatility analysis (no VIX in that endpoint either) won't be meaningful
  for synced trades.
- **Historical trade sync covers the last 3 financial years** — an
  Upstox-side limit, not this app's.

## Deploying

This is a plain Node/Express app — deploy it anywhere that runs Node (Render,
Railway, Fly.io, a VPS, …). Two things matter wherever you pick:

1. **Set the redirect URI to your real domain** in both the Upstox app
   settings and `UPSTOX_REDIRECT_URI`, e.g.
   `https://your-backend.onrender.com/api/auth/callback`.
2. **`FRONTEND_ORIGIN` must be the exact origin your frontend is served
   from** (e.g. `https://your-app.vercel.app`, no trailing slash) — CORS and
   the session cookie's `SameSite=None` behavior both depend on this being
   right. In production (`NODE_ENV=production`) the session cookie is set
   `Secure; SameSite=None`, which requires HTTPS on both sides — any real
   hosting provider gives you that by default.

Environment variables to set on the host: `PORT` (often auto-assigned by the
platform), `NODE_ENV=production`, `UPSTOX_CLIENT_ID`, `UPSTOX_CLIENT_SECRET`,
`UPSTOX_REDIRECT_URI`, `FRONTEND_ORIGIN`, `SESSION_SECRET` (a long random
string — don't reuse the dev default).

Then point the frontend's `VITE_API_BASE_URL` (build-time env var, see the
repo root `.env.example`) at wherever this ends up running.

### Scaling note

Sessions live in Express's default in-memory store — fine for one instance.
If you ever run more than one instance of this server (or restart it
frequently and don't want everyone logged out each time), swap the
`session()` store in `src/index.ts` for a shared one (e.g. `connect-redis`).
