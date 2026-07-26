import { Router } from 'express';
import { requireUpstox } from '../middleware/requireUpstox.js';
import {
  getExpiredOptionContracts,
  getHistoricalCandles,
  getLtpQuotes,
  getOptionChain,
  INDEX_INSTRUMENT_KEYS,
  type CandleUnit,
} from '../upstox/upstoxClient.js';

export const marketRouter = Router();
marketRouter.use(requireUpstox);

function resolveInstrumentKey(symbolOrKey: string): string {
  return INDEX_INSTRUMENT_KEYS[symbolOrKey.toUpperCase()] ?? symbolOrKey;
}

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
    const data = await getOptionChain(res.locals.accessToken, resolveInstrumentKey(symbol), expiry);
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
    const data = await getHistoricalCandles(res.locals.accessToken, instrumentKey, unit, interval, to, from);
    res.json(data);
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
