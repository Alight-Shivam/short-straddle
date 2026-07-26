import { describe, expect, it } from 'vitest';
import { resolveStrike } from './strikeResolver';
import type { OptionChainRow } from '../../types/liveMarket';

const SPOT = 205;

function row(strike: number, ceLtp: number, peLtp: number, ceDelta: number, peDelta: number): OptionChainRow {
  return {
    strike_price: strike,
    expiry: '2026-08-25',
    pcr: 1,
    underlying_key: 'NSE_INDEX|Nifty 50',
    underlying_spot_price: SPOT,
    call_options: {
      instrument_key: `CE-${strike}`,
      market_data: { ltp: ceLtp, close_price: ceLtp, volume: 1000, oi: 1000 },
      option_greeks: { delta: ceDelta, gamma: 0.01, theta: -1, vega: 1, iv: 15 },
    },
    put_options: {
      instrument_key: `PE-${strike}`,
      market_data: { ltp: peLtp, close_price: peLtp, volume: 1000, oi: 1000 },
      option_greeks: { delta: peDelta, gamma: 0.01, theta: -1, vega: 1, iv: 15 },
    },
  };
}

// Strikes spaced 50 apart around a 205 spot — 200 is the closest (ATM).
const CHAIN: OptionChainRow[] = [
  row(100, 110, 5, 0.95, -0.05),
  row(150, 65, 12, 0.85, -0.15),
  row(200, 30, 28, 0.52, -0.48),
  row(250, 10, 55, 0.22, -0.78),
  row(300, 3, 95, 0.08, -0.92),
];

describe('resolveStrike', () => {
  it('returns null for an empty chain', () => {
    expect(resolveStrike([], { type: 'ATM' })).toBeNull();
  });

  it('ATM resolves to the strike closest to spot', () => {
    const result = resolveStrike(CHAIN, { type: 'ATM' });
    expect(result?.matchedStrike).toBe(200);
  });

  it('ATM_OFFSET steps relative to the ATM strike in the sorted strike list, in both directions', () => {
    expect(resolveStrike(CHAIN, { type: 'ATM_OFFSET', steps: 1 })?.matchedStrike).toBe(250);
    expect(resolveStrike(CHAIN, { type: 'ATM_OFFSET', steps: 2 })?.matchedStrike).toBe(300);
    expect(resolveStrike(CHAIN, { type: 'ATM_OFFSET', steps: -1 })?.matchedStrike).toBe(150);
    expect(resolveStrike(CHAIN, { type: 'ATM_OFFSET', steps: -2 })?.matchedStrike).toBe(100);
  });

  it('ATM_OFFSET clamps at the edges of the chain instead of going out of bounds', () => {
    expect(resolveStrike(CHAIN, { type: 'ATM_OFFSET', steps: 10 })?.matchedStrike).toBe(300);
    expect(resolveStrike(CHAIN, { type: 'ATM_OFFSET', steps: -10 })?.matchedStrike).toBe(100);
  });

  it('PREMIUM_CLOSEST finds the strike whose premium is nearest the target, per option side', () => {
    // CE premiums: 110, 65, 30, 10, 3 — closest to 32 is strike 200 (30).
    expect(resolveStrike(CHAIN, { type: 'PREMIUM_CLOSEST', optionType: 'CE', targetPremium: 32 })?.matchedStrike).toBe(200);
    // PE premiums: 5, 12, 28, 55, 95 — closest to 50 is strike 250 (55).
    expect(resolveStrike(CHAIN, { type: 'PREMIUM_CLOSEST', optionType: 'PE', targetPremium: 50 })?.matchedStrike).toBe(250);
  });

  it('DELTA_CLOSEST finds the strike whose |delta| is nearest the target, per option side', () => {
    // CE deltas: .95, .85, .52, .22, .08 — closest to 0.5 is strike 200 (.52).
    expect(resolveStrike(CHAIN, { type: 'DELTA_CLOSEST', optionType: 'CE', targetDelta: 0.5 })?.matchedStrike).toBe(200);
    // PE |deltas|: .05, .15, .48, .78, .92 — closest to 0.2 is strike 150 (.15).
    expect(resolveStrike(CHAIN, { type: 'DELTA_CLOSEST', optionType: 'PE', targetDelta: 0.2 })?.matchedStrike).toBe(150);
  });
});
