import { describe, expect, it } from 'vitest';
import { nextTokenExpiry } from './upstoxClient';

describe('nextTokenExpiry', () => {
  it('returns the same day at 3:30 AM when called before that cutover', () => {
    const from = new Date(2024, 0, 1, 1, 0, 0);
    const expected = new Date(2024, 0, 1, 3, 30, 0, 0);
    expect(nextTokenExpiry(from)).toBe(expected.toISOString());
  });

  it('rolls to the next day at 3:30 AM when called after that cutover', () => {
    const from = new Date(2024, 0, 1, 10, 0, 0);
    const expected = new Date(2024, 0, 2, 3, 30, 0, 0);
    expect(nextTokenExpiry(from)).toBe(expected.toISOString());
  });

  it('rolls forward when called exactly at the cutover (boundary is >=, not >)', () => {
    const from = new Date(2024, 0, 1, 3, 30, 0, 0);
    const expected = new Date(2024, 0, 2, 3, 30, 0, 0);
    expect(nextTokenExpiry(from)).toBe(expected.toISOString());
  });
});
