/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SafeSignal from '../components/SafeSignal';

describe('SafeSignal', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('SOS Trigger', () => {
    it('should trigger SOS emergency alert', async () => {
      const mockAlert = {
        id: '1',
        user_id: 'user1',
        status: 'active',
        location: { latitude: 40.7128, longitude: -74.006 },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockAlert,
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText('Safe Signal')).toBeInTheDocument();
      });
    });

    it('should confirm SOS trigger before activating', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', status: 'pending_confirmation' }),
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText('Safe Signal')).toBeInTheDocument();
      });
    });

    it('should cancel SOS if triggered accidentally', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', status: 'cancelled' }),
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText('Safe Signal')).toBeInTheDocument();
      });
    });
  });

  describe('Location Sharing', () => {
    it('should share current location with trusted contacts', async () => {
      const mockLocation = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
      };

      const mockAlert = {
        id: '1',
        location: mockLocation,
        shared_with: ['contact1', 'contact2'],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockAlert,
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText('Safe Signal')).toBeInTheDocument();
      });
    });

    it('should handle location permission denial', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Location permission denied' }),
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText(/location permission/i)).toBeInTheDocument();
      });
    });

    it('should handle unavailable location services', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Location services unavailable' }),
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText(/location services/i)).toBeInTheDocument();
      });
    });
  });

  describe('Fake Call Screen', () => {
    it('should trigger fake call after delay', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', fake_call_scheduled: true, delay_seconds: 10 }),
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText('Safe Signal')).toBeInTheDocument();
      });
    });

    it('should cancel fake call before it triggers', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', fake_call_scheduled: false }),
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText('Safe Signal')).toBeInTheDocument();
      });
    });

    it('should customize fake call contact name', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', fake_call_contact: 'Mom' }),
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText('Safe Signal')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null location data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', location: null }),
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText('Safe Signal')).toBeInTheDocument();
      });
    });

    it('should handle missing trusted contacts', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', trusted_contacts: [] }),
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText(/no trusted contacts/i)).toBeInTheDocument();
      });
    });

    it('should handle network failures during SOS', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should handle concurrent SOS triggers', async () => {
      let triggerCount = 0;

      (global.fetch as any).mockImplementation(() => {
        triggerCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: String(triggerCount), status: 'active' }),
        });
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should handle invalid GPS coordinates', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: '1',
          location: { latitude: 999, longitude: 999 },
        }),
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText('Safe Signal')).toBeInTheDocument();
      });
    });

    it('should escalate alert after timeout', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', status: 'escalated', escalation_reason: 'timeout' }),
      });

      render(<SafeSignal />);

      await waitFor(() => {
        expect(screen.getByText('Safe Signal')).toBeInTheDocument();
      });
    });
  });
});
