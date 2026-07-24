import type { Trade } from '../types/trade';

/** Small internal helpers shared across the analysis formulas. Not part of the public API. */

export const sum = (nums: number[]): number => nums.reduce((a, b) => a + b, 0);
export const avg = (nums: number[]): number => (nums.length ? sum(nums) / nums.length : 0);

export function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = avg(nums);
  return Math.sqrt(sum(nums.map((n) => (n - m) ** 2)) / (nums.length - 1));
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toWeekKey(d: Date): string {
  // ISO week key, e.g. "2024-W05"
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function groupBy<T, K extends string | number>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const arr = map.get(key);
    if (arr) arr.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export function sortedByEntry(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime() || a.rowNumber - b.rowNumber);
}

export function pnlOf(trades: Trade[]): number[] {
  return trades.map((t) => t.pnl);
}

export function winRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  return (trades.filter((t) => t.isWin).length / trades.length) * 100;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
