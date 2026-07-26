import type { OptionChainRow } from '../../types/liveMarket';
import { findAtmRow } from './ivMetrics';

/**
 * "Automatic Strike Search" — resolves a strike-selection rule (ATM, ATM±N,
 * closest-to-a-target-premium, closest-to-a-target-delta) against a live (or,
 * later, historically-reconstructed) option chain snapshot. This is the
 * building block the Strategy Optimizer will later grid-search over; today
 * it's also exposed directly for the Live Market tab's strike finder.
 *
 * "ITM"/"Deep ITM"/"OTM"/"Deep OTM" from the spec aren't separate selector
 * types here — they're just `ATM_OFFSET` in the appropriate direction/
 * magnitude for whichever leg (CE/PE) you care about (e.g. for a call,
 * higher strikes are further OTM and lower strikes are further ITM; it's the
 * reverse for a put) — modeling them as distinct enum values would just be
 * the same offset math with an extra translation step.
 */
export type StrikeSelector =
  | { type: 'ATM' }
  | { type: 'ATM_OFFSET'; steps: number } // + = higher strikes, - = lower strikes, relative to the ATM row's position in the sorted strike list
  | { type: 'PREMIUM_CLOSEST'; optionType: 'CE' | 'PE'; targetPremium: number }
  | { type: 'DELTA_CLOSEST'; optionType: 'CE' | 'PE'; targetDelta: number };

export interface StrikeResolution {
  row: OptionChainRow;
  matchedStrike: number;
  reason: string;
}

function closestBy(rows: OptionChainRow[], optionType: 'CE' | 'PE', valueOf: (row: OptionChainRow) => number | null | undefined, target: number, label: string): StrikeResolution | null {
  let best: OptionChainRow | null = null;
  let bestDiff = Infinity;
  for (const row of rows) {
    const value = valueOf(row);
    if (value === null || value === undefined) continue;
    const diff = Math.abs(value - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = row;
    }
  }
  return best ? { row: best, matchedStrike: best.strike_price, reason: `Closest ${optionType} ${label} to ${target}` } : null;
}

export function resolveStrike(rows: OptionChainRow[], selector: StrikeSelector): StrikeResolution | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.strike_price - b.strike_price);

  switch (selector.type) {
    case 'ATM': {
      const atm = findAtmRow(sorted);
      return atm ? { row: atm, matchedStrike: atm.strike_price, reason: 'ATM (closest strike to spot)' } : null;
    }
    case 'ATM_OFFSET': {
      const atm = findAtmRow(sorted);
      if (!atm) return null;
      const atmIndex = sorted.findIndex((r) => r.strike_price === atm.strike_price);
      const clampedIndex = Math.max(0, Math.min(sorted.length - 1, atmIndex + selector.steps));
      const row = sorted[clampedIndex];
      const label = selector.steps === 0 ? 'ATM' : `ATM${selector.steps > 0 ? '+' : ''}${selector.steps}`;
      return { row, matchedStrike: row.strike_price, reason: label };
    }
    case 'PREMIUM_CLOSEST':
      return closestBy(
        sorted,
        selector.optionType,
        (row) => (selector.optionType === 'CE' ? row.call_options : row.put_options)?.market_data.ltp,
        selector.targetPremium,
        'premium',
      );
    case 'DELTA_CLOSEST':
      return closestBy(
        sorted,
        selector.optionType,
        (row) => {
          const delta = (selector.optionType === 'CE' ? row.call_options : row.put_options)?.option_greeks?.delta;
          return delta === undefined ? undefined : Math.abs(delta);
        },
        Math.abs(selector.targetDelta),
        'delta',
      );
  }
}
