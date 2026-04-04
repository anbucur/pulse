/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SlowDating from '../components/SlowDating';

// Mock fetch
global.fetch = vi.fn();

describe('SlowDating Component', () => {
  const mockOnUserClick = vi.fn();
  const mockOnMessageClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  describe('Loading State', () => {
    it('should show loading spinner', () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ matches: [], date: '2026-04-04' }),
      });

      render(<SlowDating onUserClick={mockOnUserClick} onMessageClick={mockOnMessageClick} />);
      expect(screen.getByText(/Finding your perfect matches/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no matches', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ matches: [], date: '2026-04-04' }),
      });

      render(<SlowDating />);

      await waitFor(() => {
        expect(screen.getByText(/All caught up/i)).toBeInTheDocument();
      });
    });
  });

  describe('Match Display', () => {
    const mockMatches = [
      {
        id: 1,
        user_id: 'user123',
        match_id: 456,
        compatibility_score: 85,
        conversation_starters: ['Hey! I thought we might vibe', 'What got you into music?'],
        compatibility_reason: '2 shared interests, close in age',
        shared_interests: ['music', 'travel'],
        display_name: 'Alex',
        age: 28,
        gender: 'non-binary',
        photos: ['https://example.com/photo1.jpg'],
        primary_photo_index: 0,
        bio: 'Music lover and travel enthusiast',
        location: 'San Francisco',
        tags: ['adventurous', 'creative'],
      },
    ];

    it('should display match card with details', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ matches: mockMatches, date: '2026-04-04' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ daily_match_count: 3, min_compatibility_score: 70 }),
        });

      render(<SlowDating />);

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument();
        expect(screen.getByText('28 • non-binary • San Francisco')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
        expect(screen.getByText(/music/i)).toBeInTheDocument();
        expect(screen.getByText(/travel/i)).toBeInTheDocument();
      });
    });

    it('should display compatibility score with correct color', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ matches: mockMatches, date: '2026-04-04' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ daily_match_count: 3 }),
        });

      render(<SlowDating />);

      await waitFor(() => {
        const scoreElement = screen.getByText('85%');
        expect(scoreElement).toHaveClass('text-green-400');
      });
    });

    it('should display conversation starters', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ matches: mockMatches, date: '2026-04-04' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ daily_match_count: 3 }),
        });

      render(<SlowDating />);

      await waitFor(() => {
        expect(screen.getByText(/Hey! I thought we might vibe/i)).toBeInTheDocument();
        expect(screen.getByText(/What got you into music?/i)).toBeInTheDocument();
      });
    });
  });

  describe('Match Actions', () => {
    const mockMatches = [
      {
        id: 1,
        user_id: 'user123',
        match_id: 456,
        compatibility_score: 85,
        conversation_starters: ['Test starter'],
        compatibility_reason: 'test reason',
        shared_interests: ['music'],
        display_name: 'Alex',
        age: 28,
        gender: 'non-binary',
        photos: ['https://example.com/photo1.jpg'],
        primary_photo_index: 0,
        bio: 'Test bio',
        location: 'San Francisco',
        tags: [],
      },
    ];

    it('should handle pass response', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ matches: mockMatches, date: '2026-04-04' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ daily_match_count: 3 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: { response_type: 'pass' }, mutual_match: false }),
        });

      render(<SlowDating />);

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument();
      });

      const passButton = screen.getAllByText('Pass')[0];
      await userEvent.click(passButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/slowdating/respond/456',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"response_type":"pass"'),
          })
        );
      });
    });

    it('should handle like response', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ matches: mockMatches, date: '2026-04-04' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ daily_match_count: 3 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: { response_type: 'like' }, mutual_match: false }),
        });

      render(<SlowDating />);

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument();
      });

      const likeButton = screen.getAllByText('Like')[0];
      await userEvent.click(likeButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/slowdating/respond/456',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"response_type":"like"'),
          })
        );
      });
    });

    it('should show mutual match notification', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ matches: mockMatches, date: '2026-04-04' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ daily_match_count: 3 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: { response_type: 'like' }, mutual_match: true }),
        });

      render(<SlowDating />);

      await waitFor(() => {
        expect(screen.getByText('Alex')).toBeInTheDocument();
      });

      const likeButton = screen.getAllByText('Like')[0];
      await userEvent.click(likeButton);

      await waitFor(() => {
        expect(screen.getByText(/It's a match/i)).toBeInTheDocument();
      });
    });
  });

  describe('Preferences', () => {
    it('should open preferences modal', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ matches: [], date: '2026-04-04' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ daily_match_count: 3, min_compatibility_score: 70 }),
        });

      render(<SlowDating />);

      await waitFor(() => {
        expect(screen.getByText(/All caught up/i)).toBeInTheDocument();
      });

      const settingsButton = screen.getByRole('button', { name: /preferences/i });
      await userEvent.click(settingsButton);

      expect(screen.getByText(/Dating Preferences/i)).toBeInTheDocument();
    });

    it('should update preferences', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ matches: [], date: '2026-04-04' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            daily_match_count: 3,
            min_compatibility_score: 70,
            preferred_age_range: { min: 21, max: 100 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ matches: [], date: '2026-04-04' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ daily_match_count: 5 }),
        });

      render(<SlowDating />);

      // Open preferences
      await waitFor(() => {
        expect(screen.getByText(/All caught up/i)).toBeInTheDocument();
      });

      const settingsButton = screen.getByRole('button', { name: /preferences/i });
      await userEvent.click(settingsButton);

      // Update preferences
      const selectElement = screen.getByLabelText(/Daily Matches/i);
      await userEvent.selectOptions(selectElement, '5');

      const saveButton = screen.getByRole('button', { name: /Save Preferences/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/slowdating/preferences',
          expect.objectContaining({
            method: 'PUT',
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message', async () => {
      (fetch as any).mockRejectedValue(new Error('Failed to fetch'));

      render(<SlowDating />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
      });
    });
  });
});
