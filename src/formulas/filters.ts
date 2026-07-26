import type { Trade } from '../types/trade';
import { classifyExitReason, type ExitReason } from './analysis/exitReason';
import { classifyStrikeBucket, type StrikeBucket } from './analysis/strike';
import { classifyVix, type VixBucket } from './analysis/volatility';
import { classifyExpiryBucket, type ExpiryBucket } from './analysis/expiryDay';
import { classifyAllGapTrend, type GapType, type TrendType } from './analysis/gapTrend';
import { timeToBucketLabel } from './analysis/entryTime';
import { parseDateOnly } from './liveMarket/expiryCalendar';

/**
 * Stage 3 — Dashboard Filters.
 *
 * `FilterState` mirrors the filter list from the spec. An empty array (or
 * `null` for numeric ranges) means "no restriction on this dimension".
 */
export interface FilterState {
  /** YYYY-MM-DD, inclusive. `null` means no restriction on that end. */
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  years: number[];
  months: number[]; // 1-12
  daysOfWeek: number[]; // 1=Mon..5=Fri
  entryTimeBuckets: string[];
  exitTimeBuckets: string[];
  strikeBuckets: StrikeBucket[];
  expiryBuckets: ExpiryBucket[];
  winLoss: 'all' | 'win' | 'loss';
  exitReasons: ExitReason[];
  vixBuckets: VixBucket[];
  gapTypes: GapType[];
  trendTypes: TrendType[];
  totalPremiumMin: number | null;
  totalPremiumMax: number | null;
  profitMin: number | null; // only applied when winLoss is 'win' context, or generally on pnl
  lossMax: number | null; // most negative allowed (e.g. -5000 excludes worse than that)
  durationMinMinutes: number | null;
  durationMaxMinutes: number | null;
}

export const DEFAULT_FILTERS: FilterState = {
  dateRangeStart: null,
  dateRangeEnd: null,
  years: [],
  months: [],
  daysOfWeek: [],
  entryTimeBuckets: [],
  exitTimeBuckets: [],
  strikeBuckets: [],
  expiryBuckets: [],
  winLoss: 'all',
  exitReasons: [],
  vixBuckets: [],
  gapTypes: [],
  trendTypes: [],
  totalPremiumMin: null,
  totalPremiumMax: null,
  profitMin: null,
  lossMax: null,
  durationMinMinutes: null,
  durationMaxMinutes: null,
};

/**
 * Applies the filter bar to a trade list. `fullDataset` must be the
 * UNFILTERED trade list — it's needed to compute gap/trend classification
 * consistently (those depend on neighbouring days) regardless of which
 * subset is ultimately displayed.
 */
export function applyFilters(fullDataset: Trade[], filters: FilterState): Trade[] {
  const gapTrendMap = classifyAllGapTrend(fullDataset);

  // `entryDate` carries a time-of-day (from Entry Date + Entry Time), but the
  // range picker is date-only — so the end bound must reach through the END
  // of that calendar day, not stop dead at its midnight.
  const rangeStart = filters.dateRangeStart ? parseDateOnly(filters.dateRangeStart) : null;
  const rangeEndExclusive = (() => {
    const d = filters.dateRangeEnd ? parseDateOnly(filters.dateRangeEnd) : null;
    if (!d) return null;
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return next;
  })();

  return fullDataset.filter((t) => {
    if (rangeStart && t.entryDate.getTime() < rangeStart.getTime()) return false;
    if (rangeEndExclusive && t.entryDate.getTime() >= rangeEndExclusive.getTime()) return false;
    if (filters.years.length && !filters.years.includes(t.year)) return false;
    if (filters.months.length && !filters.months.includes(t.month)) return false;
    if (filters.daysOfWeek.length && !filters.daysOfWeek.includes(t.dayOfWeek)) return false;
    if (filters.entryTimeBuckets.length && !filters.entryTimeBuckets.includes(timeToBucketLabel(t.entryTime))) return false;
    if (filters.exitTimeBuckets.length && !filters.exitTimeBuckets.includes(timeToBucketLabel(t.exitTime))) return false;
    if (filters.strikeBuckets.length && !filters.strikeBuckets.includes(classifyStrikeBucket(t))) return false;
    if (filters.expiryBuckets.length && !filters.expiryBuckets.includes(classifyExpiryBucket(t.entryDate))) return false;
    if (filters.winLoss === 'win' && !t.isWin) return false;
    if (filters.winLoss === 'loss' && !t.isLoss) return false;
    if (filters.exitReasons.length && !filters.exitReasons.includes(classifyExitReason(t))) return false;
    if (filters.vixBuckets.length) {
      const bucket = classifyVix(t.vix);
      if (!bucket || !filters.vixBuckets.includes(bucket)) return false;
    }
    if (filters.gapTypes.length) {
      const g = gapTrendMap.get(t.id)?.gap;
      if (!g || !filters.gapTypes.includes(g)) return false;
    }
    if (filters.trendTypes.length) {
      const tr = gapTrendMap.get(t.id)?.trend;
      if (!tr || !filters.trendTypes.includes(tr)) return false;
    }
    if (filters.totalPremiumMin !== null && (t.entryPremiumTotal ?? -Infinity) < filters.totalPremiumMin) return false;
    if (filters.totalPremiumMax !== null && (t.entryPremiumTotal ?? Infinity) > filters.totalPremiumMax) return false;
    if (filters.profitMin !== null && t.pnl < filters.profitMin) return false;
    if (filters.lossMax !== null && t.pnl < 0 && t.pnl < filters.lossMax) return false;
    if (filters.durationMinMinutes !== null && t.durationMinutes < filters.durationMinMinutes) return false;
    if (filters.durationMaxMinutes !== null && t.durationMinutes > filters.durationMaxMinutes) return false;
    return true;
  });
}
