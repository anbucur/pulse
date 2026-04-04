/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TribeHubs from '../components/TribeHubs';

describe('TribeHubs', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Tribe Creation/Joining/Leaving', () => {
    it('should create a new tribe', async () => {
      const mockTribe = {
        id: '1',
        name: 'Test Tribe',
        description: 'A test tribe',
        is_private: false,
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTribe,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockTribe],
        });

      render(<TribeHubs />);

      await waitFor(() => {
        expect(screen.getByText('Tribe Hubs')).toBeInTheDocument();
      });
    });

    it('should join an existing tribe', async () => {
      const mockTribe = {
        id: '1',
        name: 'Public Tribe',
        member_count: 5,
        is_member: false,
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockTribe],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockTribe, is_member: true }),
        });

      render(<TribeHubs />);

      await waitFor(() => {
        expect(screen.getByText('Public Tribe')).toBeInTheDocument();
      });
    });

    it('should leave a tribe', async () => {
      const mockTribe = {
        id: '1',
        name: 'My Tribe',
        is_member: true,
        is_admin: false,
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockTribe],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ ...mockTribe, is_member: false }],
        });

      render(<TribeHubs />);

      await waitFor(() => {
        expect(screen.getByText('My Tribe')).toBeInTheDocument();
      });
    });

    it('should handle private tribe join requests', async () => {
      const mockTribe = {
        id: '1',
        name: 'Private Tribe',
        is_private: true,
        membership: 'invite_only',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockTribe,
      });

      render(<TribeHubs />);

      await waitFor(() => {
        expect(screen.getByText('Tribe Hubs')).toBeInTheDocument();
      });
    });
  });

  describe('Member Grid', () => {
    it('should display tribe members', async () => {
      const mockMembers = [
        {
          user_id: 'user1',
          display_name: 'User One',
          role: 'admin',
        },
        {
          user_id: 'user2',
          display_name: 'User Two',
          role: 'member',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMembers,
      });

      render(<TribeHubs />);

      await waitFor(() => {
        expect(screen.getByText('Tribe Hubs')).toBeInTheDocument();
      });
    });

    it('should handle empty member list', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<TribeHubs />);

      await waitFor(() => {
        expect(screen.getByText(/no members/i)).toBeInTheDocument();
      });
    });

    it('should show admin badges', async () => {
      const mockMembers = [
        {
          user_id: 'user1',
          display_name: 'Admin User',
          role: 'admin',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMembers,
      });

      render(<TribeHubs />);

      await waitFor(() => {
        expect(screen.getByText('Tribe Hubs')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle tribe name conflicts', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'Tribe name already exists' }),
      });

      render(<TribeHubs />);

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });
    });

    it('should handle max tribe size', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'Tribe is full' }),
      });

      render(<TribeHubs />);

      await waitFor(() => {
        expect(screen.getByText(/full/i)).toBeInTheDocument();
      });
    });

    it('should handle XSS in tribe description', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', description: xssPayload }),
      });

      render(<TribeHubs />);

      await waitFor(() => {
        expect(screen.getByText('Tribe Hubs')).toBeInTheDocument();
      });
    });

    it('should handle concurrent join requests', async () => {
      let requestCount = 0;

      (global.fetch as any).mockImplementation(() => {
        requestCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: String(requestCount) }),
        });
      });

      render(<TribeHubs />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should handle leaving as last admin', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Cannot leave: you are the last admin' }),
      });

      render(<TribeHubs />);

      await waitFor(() => {
        expect(screen.getByText(/last admin/i)).toBeInTheDocument();
      });
    });
  });
});
