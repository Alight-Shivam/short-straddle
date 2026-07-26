/** Browser-only "save this text as a file" helper. Kept out of `formulas/` since it's a DOM side effect, not a calculation — formulas stays importable from Node (the backend) without pulling in `document`/`Blob`. */
export function downloadTextFile(text: string, filename: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
