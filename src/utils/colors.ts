/**
 * Chart color tokens (dark mode only, this app doesn't ship a light theme).
 * Values are taken from the validated dataviz reference palette so
 * categorical series stay colorblind-safe and profit/loss reuse the fixed
 * status colors rather than inventing new hues.
 */

// Fixed-order categorical hues (dark column) — always assign in this order, never cycle.
export const CATEGORICAL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767'];

// Status colors — reserved for good/bad state, never reused for a generic series.
export const GOOD = '#0ca30c'; // profit / win
export const CRITICAL = '#d03b3b'; // loss

// Sequential single hue (blue) for magnitude-only encodings (e.g. heatmap intensity).
export const SEQUENTIAL_BLUE = ['#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6', '#184f95'];

// Diverging pair for profit(+)/loss(-) heatmaps, neutral midpoint near zero.
export const DIVERGING_NEUTRAL = '#383835';

export const CHART_GRID = '#1e293b'; // slate-800
export const CHART_AXIS = '#64748b'; // slate-500
export const CHART_TOOLTIP_BG = '#0f172a'; // slate-900
export const CHART_TOOLTIP_BORDER = '#334155'; // slate-700

export const CE_COLOR = CATEGORICAL[0];
export const PE_COLOR = CATEGORICAL[1];
