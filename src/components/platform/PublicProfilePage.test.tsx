import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicProfilePage } from './PublicProfilePage';
import { getPublicProfile } from '@/lib/firebase/db';

vi.mock('@/lib/firebase/db', () => ({
  getPublicProfile: vi.fn(),
}));

const mockGetPublicProfile = vi.mocked(getPublicProfile);

describe('PublicProfilePage', () => {
  beforeEach(() => {
    mockGetPublicProfile.mockResolvedValue(null);
  });

  it('shows a clear fallback when the profile is not published', async () => {
    render(<PublicProfilePage userId="user-1" />);

    expect(await screen.findByText(/Profile not published/i)).toBeInTheDocument();
    expect(screen.getByText(/has not published a public profile yet/i)).toBeInTheDocument();
  });
});
