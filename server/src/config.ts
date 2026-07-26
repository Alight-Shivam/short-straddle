import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env var ${name}. Copy server/.env.example to server/.env and fill it in (see server/README.md).`,
    );
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  upstox: {
    clientId: required('UPSTOX_CLIENT_ID'),
    clientSecret: required('UPSTOX_CLIENT_SECRET'),
    redirectUri: required('UPSTOX_REDIRECT_URI'),
  },
  /** The deployed frontend's origin, e.g. https://your-app.vercel.app (no trailing slash). */
  frontendOrigin: required('FRONTEND_ORIGIN'),
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-only-insecure-secret-change-me',
};
