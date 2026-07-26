import type { NextFunction, Request, Response } from 'express';

/** Guards any route that needs a live Upstox session; attaches the access token for the handler to use. */
export function requireUpstox(req: Request, res: Response, next: NextFunction) {
  const upstox = req.session.upstox;
  if (!upstox) {
    res.status(401).json({ error: 'Not connected to Upstox. Log in via /api/auth/login first.' });
    return;
  }
  if (new Date(upstox.expiresAt).getTime() <= Date.now()) {
    res.status(401).json({ error: 'Your Upstox session expired (tokens reset daily at 3:30 AM IST). Please reconnect.' });
    return;
  }
  res.locals.accessToken = upstox.accessToken;
  next();
}
