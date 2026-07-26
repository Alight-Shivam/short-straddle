import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { buildAuthorizeUrl, exchangeCodeForToken, nextTokenExpiry } from '../upstox/upstoxClient.js';

export const authRouter = Router();

/** Kicks off the OAuth flow — redirect the browser here (not a fetch/XHR call). */
authRouter.get('/login', (req, res) => {
  const state = randomUUID();
  req.session.oauthState = state;
  const url = buildAuthorizeUrl(config.upstox.clientId, config.upstox.redirectUri, state);
  res.redirect(url);
});

/** Upstox redirects here after the user logs in on their own site. */
authRouter.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect(`${config.frontendOrigin}/?upstox_error=${encodeURIComponent(String(error))}`);
    return;
  }
  if (!code || typeof code !== 'string') {
    res.status(400).send('Missing authorization code from Upstox.');
    return;
  }
  if (!state || state !== req.session.oauthState) {
    res.status(400).send('OAuth state mismatch — please retry connecting from the app (this guards against CSRF).');
    return;
  }
  req.session.oauthState = undefined;

  try {
    const token = await exchangeCodeForToken({
      code,
      clientId: config.upstox.clientId,
      clientSecret: config.upstox.clientSecret,
      redirectUri: config.upstox.redirectUri,
    });
    req.session.upstox = {
      accessToken: token.access_token,
      obtainedAt: new Date().toISOString(),
      expiresAt: nextTokenExpiry(),
      userId: typeof token.user_id === 'string' ? token.user_id : undefined,
      userName: typeof token.user_name === 'string' ? token.user_name : undefined,
      email: typeof token.email === 'string' ? token.email : undefined,
    };
    res.redirect(`${config.frontendOrigin}/?upstox_connected=1`);
  } catch (err) {
    console.error('Upstox token exchange failed:', err);
    res.redirect(`${config.frontendOrigin}/?upstox_error=token_exchange_failed`);
  }
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('ss.sid');
    res.json({ ok: true });
  });
});

/** Frontend polls this on load (and periodically) to know whether to show "Connect" or "Connected". */
authRouter.get('/status', (req, res) => {
  const upstox = req.session.upstox;
  if (!upstox) {
    res.json({ connected: false });
    return;
  }
  const connected = new Date(upstox.expiresAt).getTime() > Date.now();
  res.json({
    connected,
    expiresAt: upstox.expiresAt,
    userName: upstox.userName,
    email: upstox.email,
  });
});
