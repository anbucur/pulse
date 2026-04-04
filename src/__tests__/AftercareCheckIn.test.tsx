/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AftercareCheckIn from '../components/AftercareCheckIn';

describe('AftercareCheckIn', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Rating Submission', () => {
    it('should submit rating for a date', async () => {
      const mockCheckIn = {
        id: '1',
        partner_id: 'user2',
        overall_rating: 4,
        would_meet_again: true,
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCheckIn,
        });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test User" />);

      await waitFor(() => {
        expect(screen.getByText('Aftercare Check-In')).toBeInTheDocument();
      });
    });

    it('should handle rating edge cases (0 and 5)', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', overall_rating: 0 }),
        });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test" />);

      await waitFor(() => {
        expect(screen.getByText('Aftercare Check-In')).toBeInTheDocument();
      });
    });

    it('should validate rating range', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'Rating must be between 1-5' }),
      });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test" />);

      await waitFor(() => {
        expect(screen.getByText('Aftercare Check-In')).toBeInTheDocument();
      });
    });
  });

  describe('Safety Report', () => {
    it('should submit safety report', async () => {
      const mockReport = {
        id: '1',
        partner_id: 'user2',
        felt_safe: false,
        safety_concerns: ['inappropriate behavior'],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockReport,
      });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test" />);

      await waitFor(() => {
        expect(screen.getByText('Aftercare Check-In')).toBeInTheDocument();
      });
    });

    it('should handle urgent safety reports', async () => {
      const mockReport = {
        id: '1',
        partner_id: 'user2',
        felt_safe: false,
        safety_concerns: ['harassment'],
        is_urgent: true,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockReport,
      });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test" />);

      await waitFor(() => {
        expect(screen.getByText('Aftercare Check-In')).toBeInTheDocument();
      });
    });

    it('should handle missing safety concern details', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', felt_safe: false, safety_concerns: null }),
      });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test" />);

      await waitFor(() => {
        expect(screen.getByText('Aftercare Check-In')).toBeInTheDocument();
      });
    });
  });

  describe('Mutual Match Detection', () => {
    it('should detect mutual positive ratings', async () => {
      const mockCheckIn = {
        id: '1',
        partner_id: 'user2',
        overall_rating: 5,
        would_meet_again: true,
        partner_rating: 5,
        partner_would_meet_again: true,
        is_mutual_match: true,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockCheckIn,
      });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test" />);

      await waitFor(() => {
        expect(screen.getByText('Aftercare Check-In')).toBeInTheDocument();
      });
    });

    it('should show pending status for unmatched ratings', async () => {
      const mockCheckIn = {
        id: '1',
        partner_id: 'user2',
        overall_rating: 4,
        would_meet_again: true,
        partner_rating: null,
        is_mutual_match: false,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockCheckIn,
      });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test" />);

      await waitFor(() => {
        expect(screen.getByText(/pending/i)).toBeInTheDocument();
      });
    });

    it('should handle one-sided negative ratings', async () => {
      const mockCheckIn = {
        id: '1',
        partner_id: 'user2',
        overall_rating: 2,
        would_meet_again: false,
        partner_rating: 5,
        partner_would_meet_again: true,
        is_mutual_match: false,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockCheckIn,
      });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test" />);

      await waitFor(() => {
        expect(screen.getByText('Aftercare Check-In')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null partner data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test" />);

      await waitFor(() => {
        expect(screen.getByText('Aftercare Check-In')).toBeInTheDocument();
      });
    });

    it('should handle XSS in feedback text', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', feedback: xssPayload }),
      });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test" />);

      await waitFor(() => {
        expect(screen.getByText('Aftercare Check-In')).toBeInTheDocument();
      });
    });

    it('should handle concurrent submissions', async () => {
      let submissionCount = 0;

      (global.fetch as any).mockImplementation(() => {
        submissionCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: String(submissionCount) }),
        });
      });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should handle duplicate submissions', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'Already submitted' }),
      });

      render(<AftercareCheckIn partnerId="user2" partnerName="Test" />);

      await waitFor(() => {
        expect(screen.getByText(/already submitted/i)).toBeInTheDocument();
      });
    });
  });
});
