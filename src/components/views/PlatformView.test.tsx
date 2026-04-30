import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformView } from './PlatformView';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/lib/firebase/AuthProvider';
import { getDecisions, getPublicProfile, getWorkspacesForUser } from '@/lib/firebase/db';

vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/lib/firebase/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/firebase/db', () => ({
  getDecisions: vi.fn(),
  getPublicProfile: vi.fn(),
  getWorkspacesForUser: vi.fn(),
  inviteWorkspaceMember: vi.fn(),
  savePublicProfile: vi.fn(),
  saveWorkspace: vi.fn(),
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockUseAuth = vi.mocked(useAuth);
const mockGetDecisions = vi.mocked(getDecisions);
const mockGetPublicProfile = vi.mocked(getPublicProfile);
const mockGetWorkspacesForUser = vi.mocked(getWorkspacesForUser);

describe('PlatformView', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1', displayName: 'Test User' },
    });
    mockUseAppStore.mockReturnValue({
      currentDocId: 'doc-1',
    });
    mockGetPublicProfile.mockResolvedValue({
      userId: 'user-1',
      name: 'Test User',
      bio: 'Bio',
      skills: ['Product'],
      createdAt: null,
      updatedAt: null,
    });
    mockGetWorkspacesForUser.mockResolvedValue([]);
    mockGetDecisions.mockResolvedValue([
      {
        id: 'decision-1',
        title: 'Keep focus on the active document',
        justification: 'Linked to doc-1',
        priority: 'high',
        impact: 8,
        effort: 3,
        userStory: 'As a user',
        tradeoffs: 'None',
        sourceDocId: 'doc-1',
        userId: 'user-1',
        createdAt: null,
        updatedAt: null,
      },
      {
        id: 'decision-2',
        title: 'Should not appear from another document',
        justification: 'Linked to doc-2',
        priority: 'medium',
        impact: 6,
        effort: 5,
        userStory: 'As a user',
        tradeoffs: 'None',
        sourceDocId: 'doc-2',
        userId: 'user-1',
        createdAt: null,
        updatedAt: null,
      },
    ]);
  });

  it('shows only decisions linked to the active document', async () => {
    render(<PlatformView />);

    expect(await screen.findByText('Keep focus on the active document')).toBeInTheDocument();
    expect(screen.queryByText('Should not appear from another document')).not.toBeInTheDocument();
    expect(screen.getByText(/1 decisions for the active document/i)).toBeInTheDocument();
  });
});
