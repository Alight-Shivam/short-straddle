import { useEffect, useState } from 'react';
import { upstoxApi, type ExpiryResolution } from '../../upstox/api';
import type { StrikeResolution, StrikeSelector } from '../../formulas/liveMarket/strikeResolver';
import { ChartCard } from '../ui/ChartCard';
import { formatCurrency, formatPct } from '../../utils/format';

type Mode = 'atm' | 'atm_offset' | 'premium' | 'delta';

/** "Automatic Expiry" + "Automatic Strike Search" from the spec, as a small interactive tool rather than a batch process — the same `resolveExpiry`/`resolveStrike` formulas this calls are exactly what the (future) Strategy Optimizer will grid-search over. */
export function StrikeExpiryFinder({ symbol, expiry, onStrikeResolved }: { symbol: string; expiry: string; onStrikeResolved: (strike: number) => void }) {
  const [expiries, setExpiries] = useState<Record<'nearest' | 'weekly' | 'monthly', ExpiryResolution | null>>({
    nearest: null,
    weekly: null,
    monthly: null,
  });

  const [mode, setMode] = useState<Mode>('atm');
  const [steps, setSteps] = useState(1);
  const [optionType, setOptionType] = useState<'CE' | 'PE'>('CE');
  const [target, setTarget] = useState(50);
  const [result, setResult] = useState<StrikeResolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (['nearest', 'weekly', 'monthly'] as const).forEach((kind) => {
      upstoxApi
        .expiry(kind)
        .then((res) => setExpiries((prev) => ({ ...prev, [kind]: res })))
        .catch(() => {
          /* non-critical — the finder still works without these cards */
        });
    });
  }, []);

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const selector: StrikeSelector =
        mode === 'atm'
          ? { type: 'ATM' }
          : mode === 'atm_offset'
            ? { type: 'ATM_OFFSET', steps }
            : mode === 'premium'
              ? { type: 'PREMIUM_CLOSEST', optionType, targetPremium: target }
              : { type: 'DELTA_CLOSEST', optionType, targetDelta: target };
      const res = await upstoxApi.strike(symbol, expiry, selector);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Strike search failed.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ChartCard title="Strike & Expiry Finder" subtitle="Resolves a strike-selection rule against the live chain — the same building block the Strategy Optimizer will later grid-search over.">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-3 gap-2 lg:col-span-3">
          {(['nearest', 'weekly', 'monthly'] as const).map((kind) => (
            <div key={kind} className="rounded-lg border border-slate-800 p-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{kind}</p>
              <p className="text-sm font-semibold text-slate-200">{expiries[kind]?.expiryDate ?? '…'}</p>
              <p className="text-[11px] text-slate-500">{expiries[kind]?.weekday ?? ''}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 lg:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200">
              <option value="atm">ATM</option>
              <option value="atm_offset">ATM ± N strikes</option>
              <option value="premium">Closest premium</option>
              <option value="delta">Closest delta</option>
            </select>

            {mode === 'atm_offset' && (
              <input
                type="number"
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                placeholder="steps (e.g. 2 or -1)"
                className="w-32 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              />
            )}

            {(mode === 'premium' || mode === 'delta') && (
              <>
                <select value={optionType} onChange={(e) => setOptionType(e.target.value as 'CE' | 'PE')} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200">
                  <option value="CE">CE</option>
                  <option value="PE">PE</option>
                </select>
                <input
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  placeholder={mode === 'premium' ? 'target premium' : 'target delta (0-1)'}
                  className="w-32 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                />
              </>
            )}

            <button onClick={runSearch} disabled={loading} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60">
              {loading ? 'Searching…' : 'Find Strike'}
            </button>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          {result && (
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-sm">
              <span className="font-semibold text-slate-100">Strike {result.matchedStrike}</span>
              <span className="text-slate-400">{result.reason}</span>
              <span className="text-slate-400">
                CE {formatCurrency(result.row.call_options?.market_data.ltp ?? 0)} · IV {result.row.call_options?.option_greeks?.iv ? formatPct(result.row.call_options.option_greeks.iv) : '—'}
              </span>
              <span className="text-slate-400">
                PE {formatCurrency(result.row.put_options?.market_data.ltp ?? 0)} · IV {result.row.put_options?.option_greeks?.iv ? formatPct(result.row.put_options.option_greeks.iv) : '—'}
              </span>
              <button onClick={() => onStrikeResolved(result.matchedStrike)} className="rounded-md border border-sky-700 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-950/50">
                Use for payoff chart ↓
              </button>
            </div>
          )}
        </div>
      </div>
    </ChartCard>
  );
}
