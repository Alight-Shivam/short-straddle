import 'express-session';

declare module 'express-session' {
  interface SessionData {
    /** Set once the OAuth flow completes; presence = "logged in to Upstox". */
    upstox?: {
      accessToken: string;
      obtainedAt: string; // ISO timestamp
      expiresAt: string; // ISO timestamp — always the next 3:30 AM IST cutover, see upstoxClient.ts
      userId?: string;
      userName?: string;
      email?: string;
    };
    /** CSRF guard for the OAuth redirect round-trip; cleared once the callback validates it. */
    oauthState?: string;
  }
}
