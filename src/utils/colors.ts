/**
 * Chart color tokens. Values are taken from the validated dataviz reference
 * palette so categorical series stay colorblind-safe and profit/loss reuse
 * the fixed status colors rather than inventing new hues.
 *
 * Data-encoding colors (CATEGORICAL/GOOD/CRITICAL/SEQUENTIAL_BLUE/
 * DIVERGING_NEUTRAL) are deliberately constant across light/dark themes —
 * they were validated for colorblind-safety and both read fine against
 * either page background. Only the chrome around them (grid lines, axis
 * ticks, tooltip surface) adapts to theme, via the CSS custom properties
 * defined in `src/index.css` (`--chart-*`), which Recharts/SVG resolve at
 * paint time same as any other CSS color value.
 */

// Fixed-order categorical hues (dark column) — always assign in this order, never cycle.
export const CATEGORICAL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767'];

// Status colors — reserved for good/bad state, never reused for a generic series.
export const GOOD = '#0ca30c'; // profit / win
export const CRITICAL = '#d03b3b'; // loss

// Sequential single hue (blue) for magnitude-only encodings (e.g. heatmap intensity).
export const SEQUENTIAL_BLUE = ['#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6', '#184f95'];

// Diverging pair for profit(+)/loss(-) heatmaps, neutral midpoint near zero.
// A fixed mid-gray (not theme-dependent) — dark enough to read on a light
// page, light enough to read on a dark one, and still supports the white
// overlay text used on top of it in the calendar heatmap either way.
export const DIVERGING_NEUTRAL = '#64748b';

export const CHART_GRID = 'var(--chart-grid)';
export const CHART_AXIS = 'var(--chart-axis)';
export const CHART_TOOLTIP_BG = 'var(--chart-tooltip-bg)';
export const CHART_TOOLTIP_BORDER = 'var(--chart-tooltip-border)';

export const CE_COLOR = CATEGORICAL[0];
export const PE_COLOR = CATEGORICAL[1];
