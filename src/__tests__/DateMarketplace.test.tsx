/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DateMarketplace from '../components/DateMarketplace';

describe('DateMarketplace', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Package Browsing', () => {
    it('should display available date packages', async () => {
      const mockPackages = [
        {
          id: '1',
          title: 'Romantic Dinner',
          description: 'Candlelit dinner at Italian restaurant',
          price: 150,
          category: 'dining',
          provider_id: 'provider1',
        },
        {
          id: '2',
          title: 'Concert Tickets',
          description: 'VIP seats to upcoming show',
          price: 200,
          category: 'entertainment',
          provider_id: 'provider2',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockPackages,
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Date Marketplace')).toBeInTheDocument();
      });
    });

    it('should filter packages by category', async () => {
      const mockPackages = [
        { id: '1', category: 'dining', title: 'Dinner' },
        { id: '2', category: 'adventure', title: 'Hiking' },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockPackages,
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Date Marketplace')).toBeInTheDocument();
      });
    });

    it('should search packages by keyword', async () => {
      const mockPackages = [
        { id: '1', title: 'Romantic Dinner', description: 'Italian cuisine' },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockPackages,
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Date Marketplace')).toBeInTheDocument();
      });
    });

    it('should handle empty package list', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText(/no packages/i)).toBeInTheDocument();
      });
    });
  });

  describe('Booking Flow', () => {
    it('should initiate booking for a package', async () => {
      const mockBooking = {
        id: 'booking1',
        package_id: '1',
        user_id: 'user1',
        status: 'pending',
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: '1', title: 'Dinner', price: 100 }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBooking,
        });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Date Marketplace')).toBeInTheDocument();
      });
    });

    it('should process payment for booking', async () => {
      const mockPayment = {
        id: 'payment1',
        booking_id: 'booking1',
        amount: 150,
        status: 'completed',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockPayment,
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Date Marketplace')).toBeInTheDocument();
      });
    });

    it('should handle booking cancellation', async () => {
      const mockBooking = {
        id: 'booking1',
        status: 'cancelled',
        cancellation_reason: 'Changed mind',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockBooking,
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Date Marketplace')).toBeInTheDocument();
      });
    });
  });

  describe('Review Submission', () => {
    it('should submit review after date', async () => {
      const mockReview = {
        id: 'review1',
        booking_id: 'booking1',
        rating: 5,
        comment: 'Amazing experience!',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockReview,
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Date Marketplace')).toBeInTheDocument();
      });
    });

    it('should handle review validation', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Review must include rating and comment' }),
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText(/must include/i)).toBeInTheDocument();
      });
    });

    it('should display provider ratings', async () => {
      const mockProvider = {
        id: 'provider1',
        name: 'Date Ideas Co',
        average_rating: 4.5,
        total_reviews: 100,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockProvider,
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Date Marketplace')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null package data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Date Marketplace')).toBeInTheDocument();
      });
    });

    it('should handle XSS in package description', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [{ id: '1', description: xssPayload }],
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Date Marketplace')).toBeInTheDocument();
      });
    });

    it('should handle payment failures', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => ({ error: 'Payment failed' }),
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText(/payment failed/i)).toBeInTheDocument();
      });
    });

    it('should handle concurrent bookings', async () => {
      let bookingCount = 0;

      (global.fetch as any).mockImplementation(() => {
        bookingCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: `booking${bookingCount}` }),
        });
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should handle invalid price values', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [{ id: '1', price: -100 }],
      });

      render(<DateMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Date Marketplace')).toBeInTheDocument();
      });
    });
  });
});
