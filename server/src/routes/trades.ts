import { Router } from 'express';
import { requireUpstox } from '../middleware/requireUpstox.js';
import { syncTradesFromUpstox } from '../upstox/tradeSync.js';

export const tradesRouter = Router();
tradesRouter.use(requireUpstox);

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/trades/sync?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Defaults to the last 3 years (Upstox's own retention limit on this
 * endpoint) through today. Returns the same `Trade[]` shape the frontend
 * already knows how to render — see upstox/tradeSync.ts for the important
 * caveats (no execution time, no VIX) before wiring this into the dashboard.
 */
tradesRouter.get('/sync', async (req, res, next) => {
  try {
    const today = new Date();
    const threeYearsAgo = new Date(today);
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : isoDate(threeYearsAgo);
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : isoDate(today);

    const result = await syncTradesFromUpstox(res.locals.accessToken, { startDate, endDate });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
