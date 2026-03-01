import { describe, it, expect } from 'vitest';
import { calculateProgress, STAGE_WEIGHTS } from './import-progress';
import type { ImportProgress } from './import-progress';

describe('calculateProgress', () => {
  it('returns 100 for complete stage', () => {
    expect(calculateProgress({ stage: 'complete', message: 'Done', slug: 'test' })).toBe(100);
  });

  it('returns 0 for error stage', () => {
    expect(calculateProgress({ stage: 'error', message: 'Failed', error: 'oops' })).toBe(0);
  });

  it('returns partial progress during extracting stage', () => {
    const progress = calculateProgress({ stage: 'extracting', message: 'Extracting...' });
    // extracting is first stage with weight 5, at 50% = 2.5
    expect(progress).toBeCloseTo(STAGE_WEIGHTS.extracting * 0.5);
  });

  it('includes completed stages weight during grading', () => {
    const progress = calculateProgress({ stage: 'grading', message: 'Grading...', completed: 5, total: 10 });
    // extracting (5) complete + grading 50% of 47 = 5 + 23.5 = 28.5
    expect(progress).toBeCloseTo(STAGE_WEIGHTS.extracting + STAGE_WEIGHTS.grading * 0.5);
  });

  it('calculates grading progress from completed/total ratio', () => {
    const progress = calculateProgress({ stage: 'grading', message: 'Grading...', completed: 3, total: 12 });
    expect(progress).toBeCloseTo(STAGE_WEIGHTS.extracting + STAGE_WEIGHTS.grading * (3 / 12));
  });

  it('calculates DOK2 grading progress correctly', () => {
    const progress = calculateProgress({ stage: 'grading_dok2', message: 'DOK2...', completed: 2, total: 4 });
    const expectedPrior = STAGE_WEIGHTS.extracting + STAGE_WEIGHTS.grading;
    expect(progress).toBeCloseTo(expectedPrior + STAGE_WEIGHTS.grading_dok2 * 0.5);
  });

  it('calculates DOK3 grading partial progress', () => {
    const progress = calculateProgress({ stage: 'grading_dok3', message: 'DOK3...', completed: 1, total: 5 });
    const expectedPrior = STAGE_WEIGHTS.extracting + STAGE_WEIGHTS.grading + STAGE_WEIGHTS.grading_dok2;
    expect(progress).toBeCloseTo(expectedPrior + STAGE_WEIGHTS.grading_dok3 * (1 / 5));
  });

  it('never exceeds 99', () => {
    // redundancy is the last active stage — progress should cap at 99
    const progress = calculateProgress({ stage: 'redundancy', message: 'Analyzing...' });
    expect(progress).toBeLessThanOrEqual(99);
  });

  it('handles zero total gracefully (division by zero guard)', () => {
    const progress = calculateProgress({ stage: 'grading', message: 'Grading...', completed: 0, total: 0 });
    // 0/0 should be treated as 0 progress within the stage
    expect(progress).toBeCloseTo(STAGE_WEIGHTS.extracting);
  });
});
