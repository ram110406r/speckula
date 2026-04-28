import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DecisionView } from './DecisionView';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/lib/firebase/AuthProvider';

vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/lib/firebase/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockUseAuth = vi.mocked(useAuth);

describe('DecisionView', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseAppStore.mockReturnValue({
      currentDocId: null,
      setPendingInsertion: vi.fn(),
      setActiveView: vi.fn(),
      setPendingDecisionForPRD: vi.fn(),
      setOutcomeLoop: vi.fn(),
    });
  });

  it('renders the empty state when no decisions are available', () => {
    render(<DecisionView />);
    expect(screen.getByText(/No decisions yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Create Decision/i })
    ).toBeDisabled();
  });
});
