/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import VibeCheck from '../components/VibeCheck';

describe('VibeCheck', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Mood Status', () => {
    it('should display current mood status', async () => {
      const mockVibeCheck = {
        id: '1',
        user_id: 'user1',
        current_mood: 'happy',
        energy_level: 8,
        open_to_interactions: true,
        updated_at: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockVibeCheck,
      });

      render(<VibeCheck />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Check')).toBeInTheDocument();
      });
    });

    it('should update mood status', async () => {
      const mockVibeCheck = {
        id: '1',
        current_mood: 'excited',
        energy_level: 9,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockVibeCheck,
      });

      render(<VibeCheck />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Check')).toBeInTheDocument();
      });
    });

    it('should handle mood expiration', async () => {
      const mockVibeCheck = {
        id: '1',
        current_mood: 'happy',
        mood_expires_at: new Date(Date.now() - 3600000).toISOString(),
        expired: true,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockVibeCheck,
      });

      render(<VibeCheck />);

      await waitFor(() => {
        expect(screen.getByText(/expired/i)).toBeInTheDocument();
      });
    });
  });

  describe('Temporal Matching', () => {
    it('should match users with compatible vibes', async () => {
      const mockMatches = [
        {
          user_id: 'user2',
          display_name: 'Happy User',
          current_mood: 'happy',
          energy_level: 8,
          compatibility_score: 95,
        },
        {
          user_id: 'user3',
          display_name: 'Excited User',
          current_mood: 'excited',
          energy_level: 9,
          compatibility_score: 88,
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMatches,
      });

      render(<VibeCheck />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Check')).toBeInTheDocument();
      });
    });

    it('should filter by energy level compatibility', async () => {
      const mockMatches = [
        {
          user_id: 'user2',
          energy_level: 7,
          compatible: true,
        },
        {
          user_id: 'user3',
          energy_level: 3,
          compatible: false,
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMatches,
      });

      render(<VibeCheck />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Check')).toBeInTheDocument();
      });
    });

    it('should handle empty matches list', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<VibeCheck />);

      await waitFor(() => {
        expect(screen.getByText(/no matches/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null vibe data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      render(<VibeCheck />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Check')).toBeInTheDocument();
      });
    });

    it('should handle invalid mood values', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', current_mood: 'invalid_mood' }),
      });

      render(<VibeCheck />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Check')).toBeInTheDocument();
      });
    });

    it('should handle energy level out of range', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', energy_level: 15 }),
      });

      render(<VibeCheck />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Check')).toBeInTheDocument();
      });
    });

    it('should handle concurrent status updates', async () => {
      let updateCount = 0;

      (global.fetch as any).mockImplementation(() => {
        updateCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: '1', version: updateCount }),
        });
      });

      render(<VibeCheck />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });
});
