import { describe, expect, it } from 'vitest';
import { calculateScore, clampScoreValue } from './scoreEngine';

describe('calculateScore', () => {
  it('handles zero/negative effort without crashing', () => {
    // Inputs are clamped to [1,10] internally; effort=0 becomes effort=1
    // (zero-cost), so the score should be the high-end "strong & cheap"
    // value rather than blowing up with a division-by-zero.
    const score = calculateScore({ impact: 10, demand: 10, confidence: 10, effort: 0 });
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('clamps the score to the 0-100 range', () => {
    const score = calculateScore({ impact: 10, demand: 10, confidence: 10, effort: 1 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns a higher score for stronger upside / lower effort', () => {
    const strong = calculateScore({ impact: 9, demand: 9, confidence: 9, effort: 2 });
    const weak = calculateScore({ impact: 4, demand: 4, confidence: 4, effort: 8 });
    expect(strong).toBeGreaterThan(weak);
  });

  it('places mid-calibration inputs in the 30-70 band per prompt anchors', () => {
    const score = calculateScore({ impact: 5, demand: 5, confidence: 5, effort: 5 });
    expect(score).toBeGreaterThanOrEqual(30);
    expect(score).toBeLessThanOrEqual(70);
  });

  it('clamps zero/negative inputs into the valid 1-10 range', () => {
    // Inputs are clamped to [1,10] internally so a zero passes as 1.
    // Two strong signals + one zero still yields a non-trivial score
    // because the other dimensions compensate via averaging.
    const score = calculateScore({ impact: 0, demand: 10, confidence: 10, effort: 5 });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('clampScoreValue', () => {
  it('clamps values to the 1-10 range', () => {
    // 0 and below clamp to 1 — the prompts always ask for an integer in
    // [1,10], and 0 was previously leaking through and being filtered as
    // "missing data" by downstream verdict logic.
    expect(clampScoreValue(-3)).toBe(1);
    expect(clampScoreValue(0)).toBe(1);
    expect(clampScoreValue(5)).toBe(5);
    expect(clampScoreValue(10)).toBe(10);
    expect(clampScoreValue(15)).toBe(10);
  });

  it('rounds fractional input', () => {
    expect(clampScoreValue(4.4)).toBe(4);
    expect(clampScoreValue(4.6)).toBe(5);
    expect(clampScoreValue(7.5)).toBe(8);
  });

  it('returns 1 for non-finite inputs', () => {
    // Non-finite values fall through the clamp and are treated as missing
    // data — defaulting to the lowest valid integer keeps them out of
    // downstream "this looks healthy" calculations.
    expect(clampScoreValue(Number.NaN)).toBe(1);
    expect(clampScoreValue(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clampScoreValue(Number.NEGATIVE_INFINITY)).toBe(1);
  });
});
