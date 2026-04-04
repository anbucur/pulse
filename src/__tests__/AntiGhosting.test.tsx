/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AntiGhosting from '../components/AntiGhosting';

// Mock fetch
global.fetch = jest.fn();

describe('AntiGhosting Component', () => {
  const mockMatchId = 123;
  const mockOtherUserId = 2;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    localStorage.removeItem('token');
  });

  describe('Pledge Section', () => {
    it('should display pledge status', async () => {
      const mockPledge = {
        id: '1',
        match_id: mockMatchId,
        user1_pledge_status: 'pending',
        user2_pledge_status: 'pending',
        response_expectation_hours: 48,
        both_agreed_at: null,
        pledge_active: false,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPledge,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({}),
        });

      render(<AntiGhosting matchId={mockMatchId} otherUserId={mockOtherUserId} />);

      await waitFor(() => {
        expect(screen.getByText(/anti-ghosting pledge/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/agree to respond within a time limit/i)).toBeInTheDocument();
    });

    it('should agree to pledge', async () => {
      const mockPledge = {
        id: '1',
        match_id: mockMatchId,
        user1_pledge_status: 'agreed',
        user2_pledge_status: 'pending',
        response_expectation_hours: 48,
        both_agreed_at: null,
        pledge_active: false,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockPledge, user1_pledge_status: 'pending' }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPledge,
        });

      render(<AntiGhosting matchId={mockMatchId} otherUserId={mockOtherUserId} />);

      await waitFor(() => {
        expect(screen.getByText(/anti-ghosting pledge/i)).toBeInTheDocument();
      });

      const agreeButton = screen.getByText(/agree/i);
      fireEvent.click(agreeButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/agree'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('should decline pledge', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: '1',
            match_id: mockMatchId,
            user1_pledge_status: 'pending',
            user2_pledge_status: 'pending',
            response_expectation_hours: 48,
            both_agreed_at: null,
            pledge_active: false,
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      render(<AntiGhosting matchId={mockMatchId} otherUserId={mockOtherUserId} />);

      await waitFor(() => {
        expect(screen.getByText(/anti-ghosting pledge/i)).toBeInTheDocument();
      });

      const declineButton = screen.getByText(/decline/i);
      fireEvent.click(declineButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/decline'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('should select different response time options', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      render(<AntiGhosting matchId={mockMatchId} otherUserId={mockOtherUserId} />);

      await waitFor(() => {
        expect(screen.getByText(/anti-ghosting pledge/i)).toBeInTheDocument();
      });

      // Test 24h option
      const button24h = screen.getByText('24h');
      fireEvent.click(button24h);

      // Test 72h option
      const button72h = screen.getByText('72h');
      fireEvent.click(button72h);

      expect(screen.getByText('24h')).toBeInTheDocument();
      expect(screen.getByText('72h')).toBeInTheDocument();
    });
  });

  describe('Last Seen Status', () => {
    it('should display online status', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user_id: mockOtherUserId,
            last_active_at: new Date().toISOString(),
            is_online: true,
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true }),
        });

      render(<AntiGhosting matchId={mockMatchId} otherUserId={mockOtherUserId} />);

      await waitFor(() => {
        expect(screen.getByText(/online now/i)).toBeInTheDocument();
      });
    });

    it('should display last active time when offline', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            user_id: mockOtherUserId,
            last_active_at: twoHoursAgo,
            is_online: false,
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true }),
        });

      render(<AntiGhosting matchId={mockMatchId} otherUserId={mockOtherUserId} />);

      await waitFor(() => {
        expect(screen.getByText(/2h ago/i)).toBeInTheDocument();
      });
    });
  });

  describe('Metrics Section', () => {
    const mockMetrics = {
      pledges_agreed: 10,
      pledges_broken: 1,
      pledge_compliance_rate: 90,
      average_response_time_hours: 2.5,
      longest_response_gap_hours: 24,
      nudges_sent: 5,
      nudges_responded: 4,
      nudge_response_rate: 80,
      current_streak_days: 5,
      longest_streak_days: 15,
      reliability_score: 95,
    };

    it('should display reliability score', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMetrics,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ user_id: mockOtherUserId, last_active_at: new Date(), is_online: false }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true }),
        });

      render(<AntiGhosting matchId={mockMatchId} otherUserId={mockOtherUserId} />);

      await waitFor(() => {
        expect(screen.getByText(/95%/)).toBeInTheDocument();
      });

      expect(screen.getByText(/reliability/i)).toBeInTheDocument();
    });

    it('should expand to show detailed metrics', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMetrics,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ user_id: mockOtherUserId, last_active_at: new Date(), is_online: false }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true }),
        });

      render(<AntiGhosting matchId={mockMatchId} otherUserId={mockOtherUserId} />);

      await waitFor(() => {
        expect(screen.getByText(/your reliability score/i)).toBeInTheDocument();
      });

      const expandButton = screen.getByText(/your reliability score/i).closest('button');
      fireEvent.click(expandButton!);

      await waitFor(() => {
        expect(screen.getByText(/day streak/i)).toBeInTheDocument();
        expect(screen.getByText(/pledges kept/i)).toBeInTheDocument();
        expect(screen.getByText(/pledges broken/i)).toBeInTheDocument();
      });
    });
  });

  describe('Nudges', () => {
    it('should display pending nudges', async () => {
      const mockNudges = [
        {
          id: '1',
          match_id: mockMatchId,
          sender_id: mockOtherUserId,
          recipient_id: 1,
          nudge_type: '24h_reminder',
          scheduled_for: new Date().toISOString(),
          status: 'pending',
          custom_message: null,
        },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNudges,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ user_id: mockOtherUserId, last_active_at: new Date(), is_online: false }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true }),
        });

      render(<AntiGhosting matchId={mockMatchId} otherUserId={mockOtherUserId} />);

      await waitFor(() => {
        expect(screen.getByText(/pending nudges/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/24h reminder/i)).toBeInTheDocument();
    });

    it('should send manual nudge', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ user_id: mockOtherUserId, last_active_at: new Date(), is_online: false }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', match_id: mockMatchId, nudge_type: 'gentle_nudge' }),
        });

      render(<AntiGhosting matchId={mockMatchId} otherUserId={mockOtherUserId} />);

      await waitFor(() => {
        expect(screen.getByText(/send friendly nudge/i)).toBeInTheDocument();
      });

      const nudgeButton = screen.getByText(/send friendly nudge/i);
      fireEvent.click(nudgeButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/trigger'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });
  });
});
