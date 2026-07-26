/**
 * Thin wrapper around the Upstox REST API (v2/v3). Every call needs a
 * per-user `accessToken` — this module has no knowledge of sessions/cookies,
 * that lives in routes/*.ts. Verified against the official Upstox developer
 * docs (upstox.com/developer/api-documentation) in July 2026 — if Upstox
 * changes a path, this is the only file that needs updating.
 */
import type { OptionChainResponse } from '../../../src/types/liveMarket.js';

const BASE_V2 = 'https://api.upstox.com/v2';
const BASE_V3 = 'https://api.upstox.com/v3';

export class UpstoxApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'UpstoxApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(url: string, accessToken: string | null, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = body?.errors?.[0]?.message ?? body?.message ?? `Upstox API responded with ${res.status}`;
    throw new UpstoxApiError(message, res.status, body);
  }
  return body as T;
}

/** Step 1 of the OAuth flow — where the browser should be redirected to log in. */
export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  return `${BASE_V2}/login/authorization/dialog?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  email?: string;
  user_id?: string;
  user_name?: string;
  [key: string]: unknown;
}

/** Step 2 — server-to-server exchange of the one-time `code` for an access token (needs client_secret, never expose this call to the browser). */
export function exchangeCodeForToken(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });
  return request<TokenResponse>(`${BASE_V2}/login/authorization/token`, null, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

/**
 * Upstox access tokens are always valid until 03:30 IST the following day,
 * regardless of when they were issued (confirmed via Upstox community docs,
 * July 2026) — there is no refresh-token flow for the standard token; the
 * user must click "Connect" again after that cutover. This helper returns
 * that cutover as an ISO string so the frontend can show "reconnect" state
 * proactively instead of waiting for a 401.
 */
export function nextTokenExpiry(from = new Date()): string {
  const cutover = new Date(from);
  cutover.setHours(3, 30, 0, 0);
  if (from.getTime() >= cutover.getTime()) cutover.setDate(cutover.getDate() + 1);
  return cutover.toISOString();
}

export function getProfile(accessToken: string) {
  return request(`${BASE_V2}/user/profile`, accessToken);
}

/** NIFTY/BANKNIFTY etc. instrument keys for the index-options chain. Verify against Upstox's instrument master if a lookup ever 404s — index naming is exchange-string-exact. */
export const INDEX_INSTRUMENT_KEYS: Record<string, string> = {
  NIFTY: 'NSE_INDEX|Nifty 50',
  BANKNIFTY: 'NSE_INDEX|Nifty Bank',
  FINNIFTY: 'NSE_INDEX|Nifty Fin Service',
  MIDCPNIFTY: 'NSE_INDEX|NIFTY MID SELECT',
};

/** expiryDate accepts YYYY-MM-DD or the relative keywords Upstox supports (current_week, next_week, current_month, next_month). */
export function getOptionChain(accessToken: string, instrumentKey: string, expiryDate: string) {
  const params = new URLSearchParams({ instrument_key: instrumentKey, expiry_date: expiryDate });
  return request<OptionChainResponse>(`${BASE_V2}/option/chain?${params.toString()}`, accessToken);
}

export function getLtpQuotes(accessToken: string, instrumentKeys: string[]) {
  const params = new URLSearchParams({ instrument_key: instrumentKeys.join(',') });
  return request<{ status: string; data: Record<string, { last_price: number; instrument_token: string }> }>(
    `${BASE_V3}/market-quote/ltp?${params.toString()}`,
    accessToken,
  );
}

export type CandleUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

export function getHistoricalCandles(
  accessToken: string,
  instrumentKey: string,
  unit: CandleUnit,
  interval: number,
  toDate: string,
  fromDate: string,
) {
  const path = `${BASE_V3}/historical-candle/${encodeURIComponent(instrumentKey)}/${unit}/${interval}/${toDate}/${fromDate}`;
  return request<{ status: string; data: { candles: [string, number, number, number, number, number, number][] } }>(path, accessToken);
}

/**
 * CAVEAT (verified July 2026): Upstox's Expired Instruments APIs live under
 * their "Upstox Plus" plan, not the plain free tier, and community reports
 * say the data doesn't go back further than ~Oct 2024. Don't build a
 * load-bearing feature on this without confirming your account has access —
 * it'll 403/return empty otherwise. The trade-sync feature deliberately
 * does NOT depend on this; it uses `getHistoricalTrades` (your own executed
 * trades), which is a plain account-history read, not premium market data.
 */
export function getExpiredOptionContracts(accessToken: string, instrumentKey: string, expiryDate: string) {
  const params = new URLSearchParams({ instrument_key: instrumentKey, expiry_date: expiryDate });
  return request<{ status: string; data: { expired_instrument_key: string; strike_price: number; instrument_type: string }[] }>(
    `${BASE_V2}/expired-instruments/option/contract?${params.toString()}`,
    accessToken,
  );
}

/**
 * A user's own executed trades, going back up to the last 3 financial years
 * (an Upstox-imposed limit, not ours). Used to auto-sync the trade log
 * instead of a manual CSV upload. `segment` should be `FO` for F&O trades.
 * Field names verified against the Upstox docs' example response (July
 * 2026) — note there is NO execution-time field, only `trade_date` (a
 * calendar date). See `tradeSync.ts` for what that limits.
 */
export interface HistoricalTradeRow {
  exchange: string;
  segment: string;
  option_type: 'CE' | 'PE' | '';
  quantity: number;
  amount: number;
  trade_id: string;
  trade_date: string; // YYYY-MM-DD
  transaction_type: 'BUY' | 'SELL';
  scrip_name: string;
  strike_price: number;
  expiry: string; // YYYY-MM-DD
  price: number;
  isin?: string;
  symbol: string;
  instrument_token?: string;
}

export function getHistoricalTrades(
  accessToken: string,
  params: { segment: 'FO' | 'EQ'; startDate: string; endDate: string; pageNumber?: number; pageSize?: number },
) {
  const qp = new URLSearchParams({
    segment: params.segment,
    start_date: params.startDate,
    end_date: params.endDate,
    page_number: String(params.pageNumber ?? 1),
    page_size: String(params.pageSize ?? 500),
  });
  return request<{
    status: string;
    data: HistoricalTradeRow[];
    meta_data?: { page_number: number; page_size: number; total_records: number; total_pages: number };
  }>(`${BASE_V2}/charges/historical-trades?${qp.toString()}`, accessToken);
}
