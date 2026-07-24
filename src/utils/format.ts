const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inrDecimal = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCurrency(n: number, decimals = false): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : '—';
  const formatted = decimals ? inrDecimal.format(Math.abs(n)) : inr.format(Math.abs(n));
  return `${n < 0 ? '-' : ''}₹${formatted}`;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : '—';
  return inr.format(n);
}

export function formatPct(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : '—';
  return `${n.toFixed(decimals)}%`;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function pnlClass(n: number): string {
  if (n > 0) return 'text-emerald-400';
  if (n < 0) return 'text-rose-400';
  return 'text-slate-400';
}
