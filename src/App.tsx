import { useCallback, useState } from 'react';
import { parseCsvFile } from './utils/csv';
import { mapRowToSchema, parseTrades } from './formulas/parseTrades';
import { runValidation, type ValidationReport } from './formulas/validation/rules';
import { verifyRequiredColumns } from './formulas/parseTrades';
import type { Trade, RawTradeRow } from './types/trade';
import { FileUpload } from './components/upload/FileUpload';
import { ValidationReportView } from './components/upload/ValidationReport';
import { Dashboard } from './components/dashboard/Dashboard';

type Stage = 'upload' | 'validated' | 'dashboard';

function App() {
  const [stage, setStage] = useState<Stage>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { rows, headers, errors } = await parseCsvFile(file);
      if (headers.length === 0) {
        setErrorMessage('Could not read any columns from this file. Please check it is a valid CSV.');
        return;
      }
      const { ok, missing } = verifyRequiredColumns(headers);
      if (!ok) {
        setErrorMessage(`This file is missing required column(s): ${missing.join(', ')}. Download the template above for the exact format.`);
        return;
      }
      if (rows.length === 0) {
        setErrorMessage('The file has headers but no data rows.');
        return;
      }

      const dataset = parseTrades(rows);
      const rawRows: RawTradeRow[] = rows.map(mapRowToSchema);
      const report = runValidation(dataset, rawRows);

      if (dataset.trades.length === 0) {
        setErrorMessage(`Parsed ${errors.length} row error(s) and found 0 valid trades. Please check the file matches the required template.`);
        return;
      }

      setTrades(dataset.trades);
      setValidationReport(report);
      setStage('validated');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to parse the file.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setStage('upload');
    setTrades([]);
    setValidationReport(null);
    setErrorMessage(null);
  }, []);

  if (stage === 'dashboard') {
    return <Dashboard trades={trades} onReset={handleReset} />;
  }

  if (stage === 'validated' && validationReport) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <ValidationReportView report={validationReport} onProceed={() => setStage('dashboard')} onReupload={handleReset} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <FileUpload onFile={handleFile} isLoading={isLoading} errorMessage={errorMessage} />
    </div>
  );
}

export default App;
