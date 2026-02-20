import { describe, test, expect } from '@jest/globals';
import { formatDateLocal } from '../src/store/state.ts';

describe('formatDateLocal (date utilities)', () => {
  test('formats YYYY-MM-DD with leading zeros', () => {
    const d = new Date(2025, 0, 5); // Jan 5, 2025
    expect(formatDateLocal(d)).toBe('2025-01-05');
  });

  test('handles months and days with leading zeros', () => {
    const d = new Date(2025, 8, 7); // Sep 7, 2025
    expect(formatDateLocal(d)).toBe('2025-09-07');
  });

  test('uses local date (avoids timezone drift compared to toISOString)', () => {
    // This timestamp should still format to the same local calendar date
    const d1 = new Date('2025-09-24T01:30:00-04:00');
    const d2 = new Date('2025-09-24T23:30:00-04:00');
    expect(formatDateLocal(d1)).toBe('2025-09-24');
    expect(formatDateLocal(d2)).toBe('2025-09-24');
  });
});
