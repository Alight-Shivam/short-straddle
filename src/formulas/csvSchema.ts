/**
 * Canonical CSV schema (Stage 0).
 *
 * This is the ONLY place the expected column headers are defined. The
 * uploaded file's header row must match these names exactly (case &
 * whitespace-insensitive matching is applied in `parseTrades.ts`).
 *
 * Editing this array changes:
 *  - the template file users download before filling in their own data
 *  - the "required columns present" validation check
 */
export const CSV_COLUMNS = [
  'Index',
  'Entry Date',
  'Entry Time',
  'Exit Date',
  'Exit Time',
  'Type',
  'Strike',
  'B/S',
  'Qty',
  'Entry Price',
  'Exit Price',
  'Vix',
  'P/L',
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** Human-readable description shown in the "download template" helper UI. */
export const CSV_COLUMN_DESCRIPTIONS: Record<CsvColumn, string> = {
  Index: 'Trade id. Whole number for the day summary row (e.g. "1"), "N.1"/"N.2" for its CE/PE legs.',
  'Entry Date': 'Date the position was opened, format YYYY-MM-DD.',
  'Entry Time': 'Time the position was opened, e.g. " 9:20:00 AM".',
  'Exit Date': 'Date the position was closed, format YYYY-MM-DD.',
  'Exit Time': 'Time the position was closed, e.g. " 3:15:00 PM".',
  Type: '"CE" or "PE" for a leg row. Leave blank on the parent/day-summary row.',
  Strike: 'Strike price of the leg. Leave blank on the parent row.',
  'B/S': '"Sell" or "Buy". Leave blank on the parent row.',
  Qty: 'Traded quantity (lots x lot-size) for the leg. Leave blank on the parent row.',
  'Entry Price': 'Option premium at entry for the leg. Leave blank on the parent row.',
  'Exit Price': 'Option premium at exit for the leg. Leave blank on the parent row.',
  Vix: 'India VIX value at entry. Only populate on the parent row.',
  'P/L': 'Profit/Loss in rupees for that row (day total on the parent row, leg P/L on leg rows).',
};

/** Builds the CSV template (header row only) that users can download and fill in. */
export function buildTemplateCsv(): string {
  const header = CSV_COLUMNS.map((c) => `"${c}"`).join(',');
  // A couple of illustrative sample rows (parent + CE + PE) so the format is unambiguous.
  const sample = [
    ['1', '2024-01-01', ' 9:20:00 AM', '2024-01-01', ' 3:15:00 PM', '', '', '', '', '', '', '13.50', '2021.50'],
    ['1.1', '2024-01-01', ' 9:20:00 AM', '2024-01-01', ' 3:15:00 PM', 'CE', '21500', 'Sell', '75', '150.00', '90.00', '', '4500.00'],
    ['1.2', '2024-01-01', ' 9:20:00 AM', '2024-01-01', ' 3:15:00 PM', 'PE', '21500', 'Sell', '75', '140.00', '160.00', '', '-1500.00'],
  ]
    .map((row) => row.map((v) => `"${v}"`).join(','))
    .join('\n');
  return `${header}\n${sample}\n`;
}

