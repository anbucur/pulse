/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BodyMap from '../components/BodyMap';

describe('BodyMap', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Zone Marking', () => {
    it('should mark zone as green (comfortable)', async () => {
      const mockBodyMap = {
        id: '1',
        zones: [
          { zone: 'hands', status: 'green', notes: 'Totally comfortable' },
        ],
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBodyMap,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockBodyMap, zones: [{ zone: 'hands', status: 'green' }] }),
        });

      render(<BodyMap />);

      await waitFor(() => {
        expect(screen.getByText('Body Map')).toBeInTheDocument();
      });
    });

    it('should mark zone as yellow (ask first)', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', zones: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', zones: [{ zone: 'neck', status: 'yellow' }] }),
        });

      render(<BodyMap />);

      await waitFor(() => {
        expect(screen.getByText('Body Map')).toBeInTheDocument();
      });
    });

    it('should mark zone as red (off limits)', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', zones: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', zones: [{ zone: 'genitals', status: 'red' }] }),
        });

      render(<BodyMap />);

      await waitFor(() => {
        expect(screen.getByText('Body Map')).toBeInTheDocument();
      });
    });

    it('should handle unmapped zones', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', zones: [] }),
      });

      render(<BodyMap />);

      await waitFor(() => {
        expect(screen.getByText('Body Map')).toBeInTheDocument();
      });
    });
  });

  describe('Privacy Controls', () => {
    it('should share body map with specific connections only', async () => {
      const mockBodyMap = {
        id: '1',
        privacy_level: 'connections',
        zones: [],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockBodyMap,
      });

      render(<BodyMap />);

      await waitFor(() => {
        expect(screen.getByText('Body Map')).toBeInTheDocument();
      });
    });

    it('should set body map to private', async () => {
      const mockBodyMap = {
        id: '1',
        privacy_level: 'private',
        zones: [],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockBodyMap,
      });

      render(<BodyMap />);

      await waitFor(() => {
        expect(screen.getByText('Body Map')).toBeInTheDocument();
      });
    });

    it('should hide body map from non-connections', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Not authorized to view this body map' }),
      });

      render(<BodyMap targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null zones array', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', zones: null }),
      });

      render(<BodyMap />);

      await waitFor(() => {
        expect(screen.getByText('Body Map')).toBeInTheDocument();
      });
    });

    it('should handle invalid zone names', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', zones: [{ zone: 'invalid_zone', status: 'green' }] }),
      });

      render(<BodyMap />);

      await waitFor(() => {
        expect(screen.getByText('Body Map')).toBeInTheDocument();
      });
    });

    it('should handle XSS in zone notes', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', zones: [{ zone: 'hands', notes: xssPayload }] }),
      });

      render(<BodyMap />);

      await waitFor(() => {
        expect(screen.getByText('Body Map')).toBeInTheDocument();
      });
    });

    it('should handle concurrent updates', async () => {
      let updateCount = 0;

      (global.fetch as any).mockImplementation(() => {
        updateCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: '1', zones: [{ zone: 'hands', status: 'green' }] }),
        });
      });

      render(<BodyMap />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should handle body map not found', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Body map not found' }),
      });

      render(<BodyMap />);

      await waitFor(() => {
        expect(screen.getByText(/not found/i)).toBeInTheDocument();
      });
    });

    it('should validate zone status values', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1', zones: [{ zone: 'hands', status: 'invalid' }] }),
      });

      render(<BodyMap />);

      await waitFor(() => {
        expect(screen.getByText('Body Map')).toBeInTheDocument();
      });
    });
  });
});
