import { describe, expect, it } from 'vitest';
import { detectThinkingStage } from './actions';

describe('detectThinkingStage', () => {
  it('classifies pain-language as the problem stage', () => {
    expect(detectThinkingStage('Users are dropping off after signup')).toBe('problem');
    expect(detectThinkingStage('There is a real issue here')).toBe('problem');
    expect(detectThinkingStage('Customers feel pain when they hit this flow')).toBe('problem');
  });

  it('classifies build/feature language as the solution stage', () => {
    expect(detectThinkingStage('We will build a new dashboard')).toBe('solution');
    expect(detectThinkingStage('Proposed solution: in-app guidance')).toBe('solution');
    expect(detectThinkingStage('Add a feature to handle this')).toBe('solution');
  });

  it('classifies metric-language as the metrics stage', () => {
    expect(detectThinkingStage('Goal: improve activation rate by 10%')).toBe('metrics');
    expect(detectThinkingStage('North-star metric is conversion')).toBe('metrics');
    expect(detectThinkingStage('We track this KPI weekly')).toBe('metrics');
  });

  it('falls back to exploration when no signal is found', () => {
    expect(detectThinkingStage('Some random thoughts here')).toBe('exploration');
    expect(detectThinkingStage('')).toBe('exploration');
  });

  it('chooses problem when both problem and solution words appear (problem comes first)', () => {
    expect(detectThinkingStage('We will build a feature to fix this drop in retention')).toBe('problem');
  });
});
