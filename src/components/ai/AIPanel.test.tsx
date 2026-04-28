import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AIPanel } from './AIPanel';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/lib/firebase/AuthProvider';

vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/lib/firebase/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/ai/actions', () => ({
  analyzeThinkingSignalsAction: vi.fn().mockResolvedValue({
    insights: [],
    suggestions: [],
    challenges: [],
    decisions: [],
  }),
  generateFeatureFromInsightAction: vi.fn(),
  generatePRDFromDecisionAction: vi.fn(),
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockUseAuth = vi.mocked(useAuth);

describe('AIPanel', () => {
  beforeEach(() => {
    mockUseAppStore.mockReturnValue({
      toggleAiPanel: vi.fn(),
      activeContext: '',
      currentDocId: 'doc-1',
      dismissedHintsByDoc: {},
      dismissHintForDoc: vi.fn(),
      setPendingInsertion: vi.fn(),
      setPendingDecisionForPRD: vi.fn(),
    });
    mockUseAuth.mockReturnValue({
      user: { displayName: 'Pat Doe', getIdToken: vi.fn() },
    });
  });

  it('greets the signed-in user', () => {
    render(<AIPanel />);
    expect(screen.getByText(/Welcome back, Pat/i)).toBeInTheDocument();
  });

  it('shows empty signals guidance when toggled open', () => {
    render(<AIPanel />);
    const toggle = screen.getAllByRole('button', { name: /Show 0/i })[0];
    fireEvent.click(toggle);

    expect(
      screen.getByText(/Keep writing\. AI will surface proactive guidance/i)
    ).toBeInTheDocument();
  });
});
