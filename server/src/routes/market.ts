import { Router } from 'express';
import { requireUpstox } from '../middleware/requireUpstox.js';
import { CACHE_TTL, getOrFetch } from '../cache/memoryCache.js';
import {
  getExpiredOptionContracts,
  getHistoricalCandles,
  getLtpQuotes,
  getOptionChain,
  INDEX_INSTRUMENT_KEYS,
  type CandleUnit,
} from '../upstox/upstoxClient.js';
import { formatDateOnly, parseDateOnly, resolveExpiry, type ExpiryKind } from '../../../src/formulas/liveMarket/expiryCalendar.js';
import { resolveStrike, type StrikeSelector } from '../../../src/formulas/liveMarket/strikeResolver.js';

export const marketRouter = Router();

function resolveInstrumentKey(symbolOrKey: string): string {
  return INDEX_INSTRUMENT_KEYS[symbolOrKey.toUpperCase()] ?? symbolOrKey;
}

/**
 * GET /api/market/expiry?symbol=NIFTY&kind=nearest|weekly|monthly&referenceDate=YYYY-MM-DD
 * Pure calendar math (reuses the same NSE expiry-weekday schedule the
 * backtest engine's `expiryDay.ts` classifies past trades with) — needs no
 * Upstox session, so it's registered before `requireUpstox` below.
 */
marketRouter.get('/expiry', (req, res) => {
  const kind = String(req.query.kind ?? 'nearest') as ExpiryKind;
  if (!['nearest', 'weekly', 'monthly'].includes(kind)) {
    res.status(400).json({ error: 'kind must be one of: nearest, weekly, monthly' });
    return;
  }
  const referenceDate = req.query.referenceDate ? parseDateOnly(String(req.query.referenceDate)) : new Date();
  if (!referenceDate) {
    res.status(400).json({ error: 'referenceDate must be a valid YYYY-MM-DD date.' });
    return;
  }
  const expiryDate = resolveExpiry(kind, referenceDate);
  res.json({
    kind,
    referenceDate: formatDateOnly(referenceDate),
    expiryDate: formatDateOnly(expiryDate),
    weekday: expiryDate.toLocaleDateString('en-US', { weekday: 'long' }),
  });
});

// Everything below needs a live Upstox session.
marketRouter.use(requireUpstox);

/**
 * GET /api/market/option-chain?symbol=NIFTY&expiry=current_week
 * `symbol` may be a shorthand (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY) or a
 * raw Upstox instrument_key for anything else. `expiry` accepts YYYY-MM-DD or
 * current_week/next_week/current_month/next_month.
 */
marketRouter.get('/option-chain', async (req, res, next) => {
  try {
    const symbol = String(req.query.symbol ?? 'NIFTY');
    const expiry = String(req.query.expiry ?? 'current_week');
    const instrumentKey = resolveInstrumentKey(symbol);
    const data = await getOrFetch(`option-chain:${instrumentKey}:${expiry}`, CACHE_TTL.LIVE_SNAPSHOT_MS, () =>
      getOptionChain(res.locals.accessToken, instrumentKey, expiry),
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** GET /api/market/quote?instrument_keys=NSE_INDEX|Nifty 50,NSE_INDEX|India VIX */
marketRouter.get('/quote', async (req, res, next) => {
  try {
    const raw = String(req.query.instrument_keys ?? '');
    const keys = raw.split(',').map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0) {
      res.status(400).json({ error: 'instrument_keys query param is required (comma-separated).' });
      return;
    }
    const data = await getLtpQuotes(res.locals.accessToken, keys);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** GET /api/market/historical-candle?instrument_key=...&unit=days&interval=1&from=2026-01-01&to=2026-07-01 */
marketRouter.get('/historical-candle', async (req, res, next) => {
  try {
    const instrumentKey = String(req.query.instrument_key ?? '');
    const unit = String(req.query.unit ?? 'days') as CandleUnit;
    const interval = Number(req.query.interval ?? 1);
    const from = String(req.query.from ?? '');
    const to = String(req.query.to ?? '');
    if (!instrumentKey || !from || !to) {
      res.status(400).json({ error: 'instrument_key, from and to query params are required.' });
      return;
    }
    const cacheKey = `candle:${instrumentKey}:${unit}:${interval}:${from}:${to}`;
    const data = await getOrFetch(cacheKey, CACHE_TTL.HISTORICAL_CANDLE_MS, () =>
      getHistoricalCandles(res.locals.accessToken, instrumentKey, unit, interval, to, from),
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/market/historical-spot?symbol=NIFTY&unit=days&interval=1&from=&to=
 * Convenience wrapper over `/historical-candle` that resolves a shorthand
 * index symbol to its instrument_key — the "Historical Spot" piece of the
 * Historical Data Engine. (Futures/stocks are intentionally out of scope
 * until the instrument-master lookup they need gets built — see roadmap.)
 */
marketRouter.get('/historical-spot', async (req, res, next) => {
  try {
    const symbol = String(req.query.symbol ?? 'NIFTY');
    const unit = String(req.query.unit ?? 'days') as CandleUnit;
    const interval = Number(req.query.interval ?? 1);
    const from = String(req.query.from ?? '');
    const to = String(req.query.to ?? '');
    if (!from || !to) {
      res.status(400).json({ error: 'from and to query params are required.' });
      return;
    }
    const instrumentKey = resolveInstrumentKey(symbol);
    const cacheKey = `candle:${instrumentKey}:${unit}:${interval}:${from}:${to}`;
    const data = await getOrFetch(cacheKey, CACHE_TTL.HISTORICAL_CANDLE_MS, () =>
      getHistoricalCandles(res.locals.accessToken, instrumentKey, unit, interval, to, from),
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/market/historical-option?instrument_key=...&unit=days&interval=1&from=&to=
 * "Historical Options" — OHLC + volume + OI for a SPECIFIC option contract
 * (get its instrument_key from `/option-chain` first). This only works for
 * contracts whose expiry hasn't happened yet; once an expiry passes, Upstox
 * moves it behind the paid "Expired Instruments" endpoints (see
 * `getExpiredOptionContracts` in upstoxClient.ts) — this route does not
 * silently fall back to that, it's a distinct, clearly-gated path.
 * NOTE: Upstox's candle data has no Implied Volatility field — "Historical
 * IV" isn't available from this endpoint (or any Upstox endpoint) at all;
 * IV only exists in the live option-chain snapshot. Capturing it over time
 * needs our own storage (the later DB phase), not something to fake here.
 */
marketRouter.get('/historical-option', async (req, res, next) => {
  try {
    const instrumentKey = String(req.query.instrument_key ?? '');
    const unit = String(req.query.unit ?? 'days') as CandleUnit;
    const interval = Number(req.query.interval ?? 1);
    const from = String(req.query.from ?? '');
    const to = String(req.query.to ?? '');
    if (!instrumentKey || !from || !to) {
      res.status(400).json({ error: 'instrument_key, from and to query params are required. Get instrument_key from /option-chain first.' });
      return;
    }
    const cacheKey = `candle:${instrumentKey}:${unit}:${interval}:${from}:${to}`;
    const data = await getOrFetch(cacheKey, CACHE_TTL.HISTORICAL_CANDLE_MS, () =>
      getHistoricalCandles(res.locals.accessToken, instrumentKey, unit, interval, to, from),
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/market/strike?symbol=NIFTY&expiry=current_week&mode=atm|atm_offset|premium|delta&steps=&optionType=&target=
 * "Automatic Strike Search" / "Premium Search" — fetches the live option
 * chain (cached, same as `/option-chain`) and resolves one strike from it
 * per the requested rule. See `formulas/liveMarket/strikeResolver.ts` for
 * the full selector semantics.
 */
marketRouter.get('/strike', async (req, res, next) => {
  try {
    const symbol = String(req.query.symbol ?? 'NIFTY');
    const expiry = String(req.query.expiry ?? 'current_week');
    const mode = String(req.query.mode ?? 'atm');

    let selector: StrikeSelector;
    if (mode === 'atm') {
      selector = { type: 'ATM' };
    } else if (mode === 'atm_offset') {
      const steps = Number(req.query.steps ?? 0);
      selector = { type: 'ATM_OFFSET', steps };
    } else if (mode === 'premium' || mode === 'delta') {
      const optionType = String(req.query.optionType ?? 'CE').toUpperCase();
      if (optionType !== 'CE' && optionType !== 'PE') {
        res.status(400).json({ error: 'optionType must be CE or PE.' });
        return;
      }
      const target = Number(req.query.target);
      if (Number.isNaN(target)) {
        res.status(400).json({ error: 'target (a number) is required for premium/delta mode.' });
        return;
      }
      selector = mode === 'premium'
        ? { type: 'PREMIUM_CLOSEST', optionType, targetPremium: target }
        : { type: 'DELTA_CLOSEST', optionType, targetDelta: target };
    } else {
      res.status(400).json({ error: 'mode must be one of: atm, atm_offset, premium, delta' });
      return;
    }

    const instrumentKey = resolveInstrumentKey(symbol);
    const chain = await getOrFetch(`option-chain:${instrumentKey}:${expiry}`, CACHE_TTL.LIVE_SNAPSHOT_MS, () =>
      getOptionChain(res.locals.accessToken, instrumentKey, expiry),
    );
    const resolution = resolveStrike(chain.data, selector);
    if (!resolution) {
      res.status(404).json({ error: 'No matching strike found in the current chain for this selector.' });
      return;
    }
    res.json(resolution);
  } catch (err) {
    next(err);
  }
});

/** GET /api/market/expired-option-contracts?symbol=NIFTY&expiry=2026-06-25 — see caveat in upstoxClient.ts (Upstox Plus plan). */
marketRouter.get('/expired-option-contracts', async (req, res, next) => {
  try {
    const symbol = String(req.query.symbol ?? 'NIFTY');
    const expiry = String(req.query.expiry ?? '');
    if (!expiry) {
      res.status(400).json({ error: 'expiry (YYYY-MM-DD) query param is required.' });
      return;
    }
    const data = await getExpiredOptionContracts(res.locals.accessToken, resolveInstrumentKey(symbol), expiry);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
