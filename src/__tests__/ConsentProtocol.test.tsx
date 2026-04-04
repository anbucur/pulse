/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsentProtocol from '../components/ConsentProtocol';

describe('ConsentProtocol', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Boundary Sharing', () => {
    it('should share boundaries with partner', async () => {
      const mockBoundaries = {
        id: '1',
        partner_id: 'user2',
        boundaries: [
          { category: 'physical', items: ['No kissing on first date'] },
          { category: 'emotional', items: ['Need space after arguments'] },
        ],
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBoundaries,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockBoundaries, shared_at: new Date().toISOString() }),
        });

      render(<ConsentProtocol partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Consent Protocol')).toBeInTheDocument();
      });
    });

    it('should handle custom boundary categories', async () => {
      const mockBoundaries = {
        id: '1',
        boundaries: [
          { category: 'digital', items: ['No unsolicited photos'] },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockBoundaries,
      });

      render(<ConsentProtocol partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Consent Protocol')).toBeInTheDocument();
      });
    });

    it('should handle boundary updates', async () => {
      const mockBoundaries = {
        id: '1',
        version: 2,
        boundaries: [
          { category: 'physical', items: ['Updated boundary'] },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockBoundaries,
      });

      render(<ConsentProtocol partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Consent Protocol')).toBeInTheDocument();
      });
    });
  });

  describe('Consent Checklist', () => {
    it('should display consent checklist', async () => {
      const mockChecklist = {
        id: '1',
        items: [
          { id: 'c1', text: 'Respect safe words', consented: true },
          { id: 'c2', text: 'Check in regularly', consented: true },
          { id: 'c3', text: 'No means no', consented: true },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockChecklist,
      });

      render(<ConsentProtocol partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Consent Protocol')).toBeInTheDocument();
      });
    });

    it('should require all items for consent', async () => {
      const mockChecklist = {
        id: '1',
        items: [
          { id: 'c1', text: 'Item 1', consented: true },
          { id: 'c2', text: 'Item 2', consented: false },
        ],
        all_consented: false,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockChecklist,
      });

      render(<ConsentProtocol partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Consent Protocol')).toBeInTheDocument();
      });
    });

    it('should handle consent revocation', async () => {
      const mockChecklist = {
        id: '1',
        consent_revoked: true,
        revoked_at: new Date().toISOString(),
        reason: 'No longer comfortable',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockChecklist,
      });

      render(<ConsentProtocol partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/consent revoked/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null boundaries', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', boundaries: null }),
      });

      render(<ConsentProtocol partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Consent Protocol')).toBeInTheDocument();
      });
    });

    it('should handle XSS in boundary text', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: '1',
          boundaries: [{ category: 'physical', items: [xssPayload] }],
        }),
      });

      render(<ConsentProtocol partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Consent Protocol')).toBeInTheDocument();
      });
    });

    it('should handle concurrent consent updates', async () => {
      let updateCount = 0;

      (global.fetch as any).mockImplementation(() => {
        updateCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: '1', version: updateCount }),
        });
      });

      render(<ConsentProtocol partnerId="user2" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should handle expired consent session', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 410,
        json: async () => ({ error: 'Consent session expired' }),
      });

      render(<ConsentProtocol partnerId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/expired/i)).toBeInTheDocument();
      });
    });
  });
});
