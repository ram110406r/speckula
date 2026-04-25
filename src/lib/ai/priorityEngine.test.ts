import { describe, expect, it } from 'vitest';
import { prioritizeSteps } from './priorityEngine';

describe('prioritizeSteps', () => {
  it('partitions steps into high (1) / medium (2) / low (rest)', () => {
    const result = prioritizeSteps(['a', 'b', 'c', 'd', 'e']);
    expect(result.high_priority).toEqual(['a']);
    expect(result.medium).toEqual(['b', 'c']);
    expect(result.low).toEqual(['d', 'e']);
  });

  it('handles fewer than 3 steps without errors', () => {
    expect(prioritizeSteps(['only'])).toEqual({
      high_priority: ['only'],
      medium: [],
      low: [],
    });
    expect(prioritizeSteps(['a', 'b'])).toEqual({
      high_priority: ['a'],
      medium: ['b'],
      low: [],
    });
  });

  it('returns empty buckets for an empty input', () => {
    expect(prioritizeSteps([])).toEqual({
      high_priority: [],
      medium: [],
      low: [],
    });
  });

  it('puts exactly 3 steps as 1 high + 2 medium + 0 low', () => {
    const result = prioritizeSteps(['x', 'y', 'z']);
    expect(result.high_priority).toEqual(['x']);
    expect(result.medium).toEqual(['y', 'z']);
    expect(result.low).toEqual([]);
  });
});
