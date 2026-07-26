import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { marketRouter } from './routes/market.js';
import { tradesRouter } from './routes/trades.js';

const app = express();

// Render/Railway/etc. sit behind a reverse proxy that terminates TLS —
// without this, express-session can't tell the connection is secure and
// will refuse to set a `Secure` cookie in production.
app.set('trust proxy', 1);

app.use(
  cors({
    origin: config.frontendOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    name: 'ss.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.isProduction,
      // Cross-origin (separate frontend/backend hosts) needs SameSite=None;
      // that only works over HTTPS, which is why it's tied to isProduction —
      // local dev (http://localhost) keeps 'lax', which browsers still send
      // across different localhost ports since they share the same site.
      sameSite: config.isProduction ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
    // NOTE: default MemoryStore — fine for a single-instance personal deployment.
    // If you scale to multiple server instances, swap this for a shared store
    // (e.g. connect-redis) so sessions don't disappear when a request lands on
    // a different instance.
  }),
);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/market', marketRouter);
app.use('/api/trades', tradesRouter);

// Central error handler — surfaces UpstoxApiError status/message instead of a bare 500.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = (err as { status?: number })?.status ?? 500;
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(typeof status === 'number' && status >= 400 && status < 600 ? status : 500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`short-straddle-server listening on :${config.port} (${config.nodeEnv})`);
});
