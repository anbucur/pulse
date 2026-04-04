/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CompatibilityMatrix from '../components/CompatibilityMatrix';

describe('CompatibilityMatrix', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Multi-dimensional Scoring', () => {
    it('should calculate compatibility across multiple dimensions', async () => {
      const mockMatrix = {
        overall_score: 82,
        dimensions: [
          { name: 'Values', score: 90, weight: 0.25 },
          { name: 'Communication', score: 75, weight: 0.25 },
          { name: 'Lifestyle', score: 80, weight: 0.25 },
          { name: 'Interests', score: 85, weight: 0.15 },
          { name: 'Physical', score: 78, weight: 0.10 },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMatrix,
      });

      render(<CompatibilityMatrix targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('82%')).toBeInTheDocument();
      });
    });

    it('should handle dimension weight validation', async () => {
      const mockMatrix = {
        overall_score: 80,
        dimensions: [
          { name: 'Values', score: 90, weight: 0.5 },
          { name: 'Communication', score: 70, weight: 0.6 },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMatrix,
      });

      render(<CompatibilityMatrix targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Compatibility Matrix')).toBeInTheDocument();
      });
    });

    it('should handle missing dimensions', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ overall_score: 50, dimensions: [] }),
      });

      render(<CompatibilityMatrix targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Compatibility Matrix')).toBeInTheDocument();
      });
    });
  });

  describe('Radar Chart', () => {
    it('should render radar chart visualization', async () => {
      const mockMatrix = {
        overall_score: 75,
        dimensions: [
          { name: 'Values', score: 80 },
          { name: 'Communication', score: 70 },
          { name: 'Lifestyle', score: 75 },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMatrix,
      });

      render(<CompatibilityMatrix targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Compatibility Matrix')).toBeInTheDocument();
      });
    });

    it('should handle chart rendering with zero scores', async () => {
      const mockMatrix = {
        overall_score: 0,
        dimensions: [
          { name: 'Values', score: 0 },
          { name: 'Communication', score: 0 },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMatrix,
      });

      render(<CompatibilityMatrix targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument();
      });
    });

    it('should handle chart rendering with perfect scores', async () => {
      const mockMatrix = {
        overall_score: 100,
        dimensions: [
          { name: 'Values', score: 100 },
          { name: 'Communication', score: 100 },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMatrix,
      });

      render(<CompatibilityMatrix targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null matrix data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      render(<CompatibilityMatrix targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Compatibility Matrix')).toBeInTheDocument();
      });
    });

    it('should handle negative scores', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ overall_score: -10, dimensions: [] }),
      });

      render(<CompatibilityMatrix targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Compatibility Matrix')).toBeInTheDocument();
      });
    });

    it('should handle scores over 100', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ overall_score: 150, dimensions: [] }),
      });

      render(<CompatibilityMatrix targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Compatibility Matrix')).toBeInTheDocument();
      });
    });

    it('should handle calculation timeout', async () => {
      (global.fetch as any).mockImplementation(() =>
        new Promise((resolve) => setTimeout(resolve, 10000))
      );

      render(<CompatibilityMatrix targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/calculating/i)).toBeInTheDocument();
      });
    });
  });
});
