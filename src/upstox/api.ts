import type { OptionChainResponse } from '../types/liveMarket';
import type { Trade } from '../types/trade';
import type { ExpiryKind } from '../formulas/liveMarket/expiryCalendar';
import type { StrikeResolution, StrikeSelector } from '../formulas/liveMarket/strikeResolver';

/** Mirrors `server/src/upstox/upstoxClient.ts`'s `CandleUnit` — kept as a small local type rather than a cross-package import since the frontend and backend are separate deployables. */
export type CandleUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

export interface ExpiryResolution {
  kind: ExpiryKind;
  referenceDate: string;
  expiryDate: string;
  weekday: string;
}

export interface CandleResponse {
  status: string;
  data: { candles: [string, number, number, number, number, number, number][] };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include', // send/receive the session cookie cross-origin
    headers: { Accept: 'application/json', ...init?.headers },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed with ${res.status}`, res.status);
  }
  return body as T;
}

export interface AuthStatus {
  connected: boolean;
  expiresAt?: string;
  userName?: string;
  email?: string;
  /** Set client-side only, from the ?upstox_error= redirect param — not part of the /status response. */
  lastError?: string;
}

export const upstoxApi = {
  /** Full-page redirect (not a fetch) — OAuth requires an actual browser navigation to Upstox's login page. */
  loginUrl: () => `${API_BASE}/api/auth/login`,
  logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  status: () => apiFetch<AuthStatus>('/api/auth/status'),

  optionChain: (symbol: string, expiry: string) =>
    apiFetch<OptionChainResponse>(`/api/market/option-chain?symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`),

  quote: (instrumentKeys: string[]) =>
    apiFetch<{ status: string; data: Record<string, { last_price: number; instrument_token: string }> }>(
      `/api/market/quote?instrument_keys=${encodeURIComponent(instrumentKeys.join(','))}`,
    ),

  expiry: (kind: ExpiryKind, referenceDate?: string) => {
    const params = new URLSearchParams({ kind });
    if (referenceDate) params.set('referenceDate', referenceDate);
    return apiFetch<ExpiryResolution>(`/api/market/expiry?${params.toString()}`);
  },

  strike: (symbol: string, expiry: string, selector: StrikeSelector) => {
    const params = new URLSearchParams({ symbol, expiry });
    if (selector.type === 'ATM') {
      params.set('mode', 'atm');
    } else if (selector.type === 'ATM_OFFSET') {
      params.set('mode', 'atm_offset');
      params.set('steps', String(selector.steps));
    } else if (selector.type === 'PREMIUM_CLOSEST') {
      params.set('mode', 'premium');
      params.set('optionType', selector.optionType);
      params.set('target', String(selector.targetPremium));
    } else {
      params.set('mode', 'delta');
      params.set('optionType', selector.optionType);
      params.set('target', String(selector.targetDelta));
    }
    return apiFetch<StrikeResolution>(`/api/market/strike?${params.toString()}`);
  },

  historicalSpot: (symbol: string, unit: CandleUnit, interval: number, from: string, to: string) =>
    apiFetch<CandleResponse>(
      `/api/market/historical-spot?symbol=${encodeURIComponent(symbol)}&unit=${unit}&interval=${interval}&from=${from}&to=${to}`,
    ),

  historicalOption: (instrumentKey: string, unit: CandleUnit, interval: number, from: string, to: string) =>
    apiFetch<CandleResponse>(
      `/api/market/historical-option?instrument_key=${encodeURIComponent(instrumentKey)}&unit=${unit}&interval=${interval}&from=${from}&to=${to}`,
    ),

  syncTrades: async (startDate?: string, endDate?: string): Promise<{ trades: Trade[]; skipped: string[]; totalRawFills: number }> => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString();
    const raw = await apiFetch<{ trades: JsonTrade[]; skipped: string[]; totalRawFills: number }>(`/api/trades/sync${qs ? `?${qs}` : ''}`);
    return { ...raw, trades: raw.trades.map(reviveTrade) };
  },
};

/** Same shape as `Trade`, but every `Date` field arrives as an ISO string over JSON. */
type JsonTrade = Omit<Trade, 'entryDate' | 'exitDate' | 'legs' | 'ce' | 'pe'> & {
  entryDate: string;
  exitDate: string;
  legs: (Omit<Trade['legs'][number], 'entryDate' | 'exitDate'> & { entryDate: string | null; exitDate: string | null })[];
  ce: (Omit<NonNullable<Trade['ce']>, 'entryDate' | 'exitDate'> & { entryDate: string | null; exitDate: string | null }) | null;
  pe: (Omit<NonNullable<Trade['pe']>, 'entryDate' | 'exitDate'> & { entryDate: string | null; exitDate: string | null }) | null;
};

/** Rehydrates the ISO date strings a JSON response carries back into real `Date` objects the analysis engine expects. */
function reviveTrade(t: JsonTrade): Trade {
  const reviveLeg = <L extends { entryDate: string | null; exitDate: string | null }>(leg: L | null) =>
    leg ? { ...leg, entryDate: leg.entryDate ? new Date(leg.entryDate) : null, exitDate: leg.exitDate ? new Date(leg.exitDate) : null } : null;

  return {
    ...t,
    entryDate: new Date(t.entryDate),
    exitDate: new Date(t.exitDate),
    legs: t.legs.map((l) => reviveLeg(l)!),
    ce: reviveLeg(t.ce),
    pe: reviveLeg(t.pe),
  } as Trade;
}
