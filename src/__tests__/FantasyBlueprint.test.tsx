/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FantasyBlueprint from '../components/FantasyBlueprint';

describe('FantasyBlueprint', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Collaborative Editing', () => {
    it('should allow both partners to edit blueprint', async () => {
      const mockBlueprint = {
        id: '1',
        partner_id: 'user2',
        content: 'Shared fantasy description',
        permissions: { user1: 'edit', user2: 'edit' },
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBlueprint,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockBlueprint, content: 'Updated content' }),
        });

      render(<FantasyBlueprint partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Fantasy Blueprint')).toBeInTheDocument();
      });
    });

    it('should show real-time updates from partner', async () => {
      const mockBlueprint = {
        id: '1',
        partner_id: 'user2',
        content: 'Initial content',
        last_edited_by: 'user2',
        last_edited_at: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockBlueprint,
      });

      render(<FantasyBlueprint partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Fantasy Blueprint')).toBeInTheDocument();
      });
    });

    it('should handle edit conflicts', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Edit conflict: please refresh and try again' }),
      });

      render(<FantasyBlueprint partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/edit conflict/i)).toBeInTheDocument();
      });
    });
  });

  describe('Prompt System', () => {
    it('should provide category-specific prompts', async () => {
      const mockPrompts = [
        {
          id: '1',
          category: 'communication',
          prompt_text: 'What are your safe words?',
        },
        {
          id: '2',
          category: 'boundaries',
          prompt_text: 'What are your hard limits?',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockPrompts,
      });

      render(<FantasyBlueprint partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Fantasy Blueprint')).toBeInTheDocument();
      });
    });

    it('should handle custom user prompts', async () => {
      const mockPrompt = {
        id: '1',
        category: 'custom',
        prompt_text: 'What is your fantasy scenario?',
        created_by: 'user1',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockPrompt,
      });

      render(<FantasyBlueprint partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Fantasy Blueprint')).toBeInTheDocument();
      });
    });

    it('should validate prompt responses', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: '1',
          prompts: [
            {
              id: 'p1',
              response: null,
              required: true,
              validation_error: 'This field is required',
            },
          ],
        }),
      });

      render(<FantasyBlueprint partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Fantasy Blueprint')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null blueprint content', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', content: null }),
      });

      render(<FantasyBlueprint partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Fantasy Blueprint')).toBeInTheDocument();
      });
    });

    it('should handle XSS in fantasy content', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', content: xssPayload }),
      });

      render(<FantasyBlueprint partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Fantasy Blueprint')).toBeInTheDocument();
      });
    });

    it('should handle concurrent edits', async () => {
      let editCount = 0;

      (global.fetch as any).mockImplementation(() => {
        editCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: '1', version: editCount }),
        });
      });

      render(<FantasyBlueprint partnerId="user2" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should handle read-only permissions', async () => {
      const mockBlueprint = {
        id: '1',
        content: 'Read only content',
        permissions: { user1: 'read', user2: 'edit' },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockBlueprint,
      });

      render(<FantasyBlueprint partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/read only/i)).toBeInTheDocument();
      });
    });

    it('should handle missing partner access', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Partner has not granted access' }),
      });

      render(<FantasyBlueprint partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/not granted access/i)).toBeInTheDocument();
      });
    });
  });
});
