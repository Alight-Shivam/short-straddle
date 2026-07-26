/**
 * "Dashboard pages + CSV/Excel/PDF export" — the export half of this phase.
 * Browser-only side effects (like downloadCsv.ts), kept out of `formulas/`.
 *
 * Library choices, and why: `write-excel-file` (not the more common `xlsx`/
 * `exceljs`) for the .xlsx output — it's write-only by design, so it never
 * has to parse untrusted spreadsheet input, which sidesteps the whole class
 * of prototype-pollution/ReDoS advisories those general-purpose libraries
 * carry (confirmed via `npm audit`: `xlsx` has an unfixed high-severity
 * advisory, `exceljs` pulls in a much larger vulnerable transitive tree;
 * `write-excel-file` had zero at install time). `jspdf` + `jspdf-autotable`
 * for the PDF — the standard, actively-maintained pairing for client-side
 * PDF table generation.
 */
import Papa from 'papaparse';
import writeXlsxFile, { type Sheet } from 'write-excel-file/browser';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Trade } from '../types/trade';
import type { AnalysisReport } from '../formulas';
import { classifyExitReason } from '../formulas/analysis/exitReason';
import { formatDate } from './format';
import { downloadTextFile } from './downloadCsv';

const TRADE_EXPORT_COLUMNS = [
  'ID', 'Entry Date', 'Day', 'Entry Time', 'Exit Time', 'CE Strike', 'PE Strike',
  'Entry Premium', 'Exit Premium', 'VIX', 'Duration (min)', 'Exit Reason', 'P/L', 'Result',
] as const;

function tradeExportRow(t: Trade): (string | number)[] {
  return [
    t.id,
    formatDate(t.entryDate),
    t.dayName,
    t.entryTime,
    t.exitTime,
    t.ce?.strike ?? '',
    t.pe?.strike ?? '',
    t.entryPremiumTotal ?? '',
    t.exitPremiumTotal ?? '',
    t.vix ?? '',
    t.durationMinutes,
    classifyExitReason(t),
    t.pnl,
    t.isWin ? 'Win' : t.isLoss ? 'Loss' : 'Scratch',
  ];
}

export function exportTradesToCsv(trades: Trade[], filename = 'trade-log.csv'): void {
  const rows = trades.map((t) => {
    const values = tradeExportRow(t);
    return Object.fromEntries(TRADE_EXPORT_COLUMNS.map((c, i) => [c, values[i]]));
  });
  const csv = Papa.unparse(rows, { columns: [...TRADE_EXPORT_COLUMNS] });
  downloadTextFile(csv, filename, 'text/csv;charset=utf-8;');
}

export async function exportTradesToExcel(trades: Trade[], report: AnalysisReport, filename = 'trade-report.xlsx'): Promise<void> {
  const tradeSheet: Sheet<Blob> = {
    sheet: 'Trade Log',
    data: [
      TRADE_EXPORT_COLUMNS.map((c) => ({ value: c, fontWeight: 'bold' })),
      ...trades.map((t) => tradeExportRow(t).map((v) => ({ value: v }))),
    ],
  };

  const summaryRows: [string, string | number][] = [
    ['Total Trades', report.overview.totalTrades],
    ['Winning Trades', report.overview.winningTrades],
    ['Losing Trades', report.overview.losingTrades],
    ['Win Rate %', report.overview.winRatePct],
    ['Net Profit', report.overview.netProfit],
    ['Gross Profit', report.overview.grossProfit],
    ['Gross Loss', report.overview.grossLoss],
    ['Profit Factor', report.overview.profitFactor],
    ['Expectancy / Trade', report.overview.expectancy],
    ['Max Drawdown', report.drawdown.maxDrawdown],
    ['Max Drawdown %', report.drawdown.maxDrawdownPct],
    ['Sharpe Ratio', report.riskMetrics.sharpeRatio],
    ['Sortino Ratio', report.riskMetrics.sortinoRatio],
    ['Calmar Ratio', Number.isFinite(report.riskMetrics.calmarRatio) ? report.riskMetrics.calmarRatio : 0],
    ['Ulcer Index', report.riskMetrics.ulcerIndex],
  ];
  const summarySheet: Sheet<Blob> = {
    sheet: 'Summary',
    data: [
      [{ value: 'Metric', fontWeight: 'bold' }, { value: 'Value', fontWeight: 'bold' }],
      ...summaryRows.map(([label, value]) => [{ value: label }, { value }]),
    ],
  };

  await writeXlsxFile([tradeSheet, summarySheet]).toFile(filename);
}

export function exportSummaryToPdf(report: AnalysisReport, filename = 'summary-report.pdf'): void {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Short Straddle Backtest — Summary Report', 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [['Metric', 'Value']],
    body: [
      ['Total Trades', String(report.overview.totalTrades)],
      ['Win Rate', `${report.overview.winRatePct.toFixed(1)}%`],
      ['Net Profit', report.overview.netProfit.toFixed(0)],
      ['Profit Factor', report.overview.profitFactor.toFixed(2)],
      ['Expectancy / Trade', report.overview.expectancy.toFixed(0)],
      ['Max Drawdown', `${report.drawdown.maxDrawdown.toFixed(0)} (${report.drawdown.maxDrawdownPct.toFixed(1)}%)`],
      ['Sharpe Ratio', report.riskMetrics.sharpeRatio.toFixed(2)],
      ['Sortino Ratio', report.riskMetrics.sortinoRatio.toFixed(2)],
    ],
    styles: { fontSize: 9 },
  });

  const afterKpis = lastAutoTableY(doc);
  if (report.insights.length > 0) {
    autoTable(doc, {
      startY: afterKpis + 8,
      head: [['Insight', 'Message']],
      body: report.insights.map((i) => [i.title, i.message]),
      styles: { fontSize: 8, cellWidth: 'wrap' },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 140 } },
    });
  }

  doc.save(filename);
}

/** jspdf-autotable attaches this at runtime (`jsPDFDoc.lastAutoTable = table`) but it isn't in jsPDF's own type defs. */
function lastAutoTableY(doc: jsPDF): number {
  const withTable = doc as unknown as { lastAutoTable?: { finalY: number } };
  return withTable.lastAutoTable?.finalY ?? 28;
}
