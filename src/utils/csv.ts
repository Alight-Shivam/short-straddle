import Papa from 'papaparse';

export function parseCsvFile(file: File): Promise<{ rows: Record<string, unknown>[]; headers: string[]; errors: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        resolve({
          rows: results.data,
          headers: results.meta.fields ?? [],
          errors: results.errors.map((e) => `Row ${e.row ?? '?'}: ${e.message}`),
        });
      },
      error: (err) => reject(err),
    });
  });
}
