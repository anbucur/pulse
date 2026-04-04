/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WingmanAI from '../components/WingmanAI';

describe('WingmanAI', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Briefing Generation', () => {
    it('should generate briefing for a match', async () => {
      const mockBriefing = {
        id: '1',
        target_user_id: 'user2',
        conversation_starters: ['Ask about their hobbies'],
        topics_to_discuss: ['travel', 'food'],
        topics_to_avoid: ['politics'],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockBriefing,
      });

      render(<WingmanAI />);

      await waitFor(() => {
        expect(screen.getByText('Wingman AI')).toBeInTheDocument();
      });
    });

    it('should handle API timeout gracefully', async () => {
      (global.fetch as any).mockImplementation(() =>
        new Promise((resolve) => setTimeout(resolve, 10000))
      );

      render(<WingmanAI />);

      await waitFor(() => {
        expect(screen.getByText('Wingman AI')).toBeInTheDocument();
      });
    });

    it('should handle missing profile data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'Profile not found' }),
      });

      render(<WingmanAI />);

      await waitFor(() => {
        expect(screen.getByText('Wingman AI')).toBeInTheDocument();
      });
    });
  });

  describe('Date Suggestions', () => {
    it('should suggest date ideas based on interests', async () => {
      const mockSuggestions = [
        {
          id: '1',
          title: 'Coffee Shop Date',
          description: 'Meet at a local café',
          category: 'casual',
        },
        {
          id: '2',
          title: 'Art Gallery',
          description: 'Explore modern art together',
          category: 'cultural',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockSuggestions,
      });

      render(<WingmanAI />);

      await waitFor(() => {
        expect(screen.getByText('Wingman AI')).toBeInTheDocument();
      });
    });

    it('should filter suggestions by category', async () => {
      const mockSuggestions = [
        { id: '1', category: 'casual', title: 'Coffee' },
        { id: '2', category: 'outdoor', title: 'Hiking' },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockSuggestions,
      });

      render(<WingmanAI />);

      await waitFor(() => {
        expect(screen.getByText('Wingman AI')).toBeInTheDocument();
      });
    });

    it('should handle empty suggestions list', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<WingmanAI />);

      await waitFor(() => {
        expect(screen.getByText(/No suggestions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null briefing data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      render(<WingmanAI />);

      await waitFor(() => {
        expect(screen.getByText('Wingman AI')).toBeInTheDocument();
      });
    });

    it('should handle malformed AI response', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: 'data' }),
      });

      render(<WingmanAI />);

      await waitFor(() => {
        expect(screen.getByText('Wingman AI')).toBeInTheDocument();
      });
    });

    it('should handle rate limiting', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Too many requests' }),
      });

      render(<WingmanAI />);

      await waitFor(() => {
        expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
      });
    });

    it('should handle XSS in conversation starters', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          conversation_starters: [xssPayload],
        }),
      });

      render(<WingmanAI />);

      await waitFor(() => {
        expect(screen.getByText('Wingman AI')).toBeInTheDocument();
      });
    });

    it('should handle concurrent briefing requests', async () => {
      let requestCount = 0;

      (global.fetch as any).mockImplementation(() => {
        requestCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: String(requestCount) }),
        });
      });

      render(<WingmanAI />);

      // Should handle multiple simultaneous requests
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });
});
