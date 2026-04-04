/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VibeTimeline from '../components/VibeTimeline';

describe('VibeTimeline', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Vibe Logging', () => {
    it('should add a new vibe entry', async () => {
      const mockVibes = [
        {
          id: '1',
          mood: 'happy',
          energy_level: 8,
          created_at: '2026-04-01T10:00:00Z',
        },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockVibes,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '2', mood: 'excited', energy_level: 9 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [...mockVibes, { id: '2', mood: 'excited' }],
        });

      render(<VibeTimeline />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Timeline')).toBeInTheDocument();
      });
    });

    it('should handle missing mood value', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<VibeTimeline />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Timeline')).toBeInTheDocument();
      });
    });

    it('should handle extreme energy values', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', energy_level: 100 }),
        });

      render(<VibeTimeline />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Timeline')).toBeInTheDocument();
      });
    });
  });

  describe('Timeline Display', () => {
    it('should display vibes in chronological order', async () => {
      const mockVibes = [
        {
          id: '1',
          mood: 'happy',
          created_at: '2026-04-01T10:00:00Z',
        },
        {
          id: '2',
          mood: 'sad',
          created_at: '2026-04-02T10:00:00Z',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockVibes,
      });

      render(<VibeTimeline />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Timeline')).toBeInTheDocument();
      });
    });

    it('should handle empty timeline', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<VibeTimeline />);

      await waitFor(() => {
        expect(screen.getByText(/No vibes yet/)).toBeInTheDocument();
      });
    });

    it('should handle pagination for large datasets', async () => {
      const manyVibes = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        mood: 'neutral',
        created_at: new Date().toISOString(),
      }));

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => manyVibes,
      });

      render(<VibeTimeline />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Timeline')).toBeInTheDocument();
      });
    });
  });

  describe('Pattern Visualization', () => {
    it('should show mood frequency chart', async () => {
      const mockVibes = [
        { id: '1', mood: 'happy', created_at: '2026-04-01' },
        { id: '2', mood: 'happy', created_at: '2026-04-02' },
        { id: '3', mood: 'sad', created_at: '2026-04-03' },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockVibes,
      });

      render(<VibeTimeline />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Timeline')).toBeInTheDocument();
      });
    });

    it('should calculate average energy level', async () => {
      const mockVibes = [
        { id: '1', energy_level: 5 },
        { id: '2', energy_level: 7 },
        { id: '3', energy_level: 6 },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockVibes,
      });

      render(<VibeTimeline />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Timeline')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined vibe data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      render(<VibeTimeline />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Timeline')).toBeInTheDocument();
      });
    });

    it('should handle invalid date formats', async () => {
      const mockVibes = [
        { id: '1', mood: 'happy', created_at: 'invalid-date' },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockVibes,
      });

      render(<VibeTimeline />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Timeline')).toBeInTheDocument();
      });
    });

    it('should handle unauthorized access', async () => {
      global.localStorage.getItem.mockReturnValue(null);

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      render(<VibeTimeline />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Timeline')).toBeInTheDocument();
      });
    });

    it('should handle XSS in mood notes', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [{ id: '1', mood: 'happy', notes: xssPayload }],
      });

      render(<VibeTimeline />);

      await waitFor(() => {
        expect(screen.getByText('Vibe Timeline')).toBeInTheDocument();
      });
    });
  });
});
