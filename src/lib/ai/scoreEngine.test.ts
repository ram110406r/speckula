import { describe, expect, it } from 'vitest';
import { calculateScore, clampScoreValue } from './scoreEngine';

describe('calculateScore', () => {
  it('returns 0 when effort is zero (avoids division by zero)', () => {
    expect(calculateScore({ impact: 10, demand: 10, confidence: 10, effort: 0 })).toBe(0);
  });

  it('returns 0 when effort is negative', () => {
    expect(calculateScore({ impact: 10, demand: 10, confidence: 10, effort: -5 })).toBe(0);
  });

  it('caps the score at 100 for high-impact low-effort ideas', () => {
    expect(calculateScore({ impact: 10, demand: 10, confidence: 10, effort: 1 })).toBe(100);
  });

  it('rounds to the nearest integer', () => {
    // (5 * 5 * 5) / 4 = 31.25 → round(312.5) = 313 → capped at 100
    expect(calculateScore({ impact: 5, demand: 5, confidence: 5, effort: 4 })).toBe(100);
    // (3 * 3 * 3) / 9 = 3 → 30
    expect(calculateScore({ impact: 3, demand: 3, confidence: 3, effort: 9 })).toBe(30);
  });

  it('returns 0 when any signal is zero', () => {
    expect(calculateScore({ impact: 0, demand: 10, confidence: 10, effort: 5 })).toBe(0);
    expect(calculateScore({ impact: 10, demand: 0, confidence: 10, effort: 5 })).toBe(0);
    expect(calculateScore({ impact: 10, demand: 10, confidence: 0, effort: 5 })).toBe(0);
  });
});

describe('clampScoreValue', () => {
  it('clamps values to the 0-10 range', () => {
    expect(clampScoreValue(-3)).toBe(0);
    expect(clampScoreValue(0)).toBe(0);
    expect(clampScoreValue(5)).toBe(5);
    expect(clampScoreValue(10)).toBe(10);
    expect(clampScoreValue(15)).toBe(10);
  });

  it('rounds fractional input', () => {
    expect(clampScoreValue(4.4)).toBe(4);
    expect(clampScoreValue(4.6)).toBe(5);
    expect(clampScoreValue(7.5)).toBe(8);
  });
});
