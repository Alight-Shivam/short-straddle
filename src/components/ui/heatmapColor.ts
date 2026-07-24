import { CRITICAL, DIVERGING_NEUTRAL, GOOD } from '../../utils/colors';

/** Diverging blue/red-style intensity (here green=profit / red=loss to match P/L semantics) scaled by magnitude vs the max abs value in the set. */
export function divergingColor(value: number, maxAbs: number): string {
  if (maxAbs === 0 || value === 0) return DIVERGING_NEUTRAL;
  const intensity = Math.min(1, Math.abs(value) / maxAbs);
  const base = value > 0 ? GOOD : CRITICAL;
  // Blend base color toward the neutral midpoint for low-intensity values.
  return mix(DIVERGING_NEUTRAL, base, 0.25 + intensity * 0.75);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
