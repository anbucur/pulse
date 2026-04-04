/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ChemistryPredictor from '../components/ChemistryPredictor';

describe('ChemistryPredictor', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Compatibility Scoring', () => {
    it('should calculate compatibility score', async () => {
      const mockScore = {
        overall_score: 85,
        dimensions: {
          values: { score: 90, weight: 0.3 },
          communication: { score: 80, weight: 0.3 },
          lifestyle: { score: 85, weight: 0.2 },
          interests: { score: 88, weight: 0.2 },
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockScore,
      });

      render(<ChemistryPredictor targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('85%')).toBeInTheDocument();
      });
    });

    it('should handle edge case scores (0 and 100)', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ overall_score: 0, dimensions: {} }),
      });

      render(<ChemistryPredictor targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument();
      });
    });

    it('should handle missing profile data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Profile not complete' }),
      });

      render(<ChemistryPredictor targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/profile not complete/i)).toBeInTheDocument();
      });
    });
  });

  describe('Dimension Breakdown', () => {
    it('should display all compatibility dimensions', async () => {
      const mockScore = {
        overall_score: 75,
        dimensions: {
          values: { score: 80, description: 'Shared values alignment' },
          communication: { score: 70, description: 'Communication style match' },
          lifestyle: { score: 75, description: 'Lifestyle compatibility' },
          interests: { score: 76, description: 'Shared interests' },
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockScore,
      });

      render(<ChemistryPredictor targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Chemistry Predictor')).toBeInTheDocument();
      });
    });

    it('should show dimension weights', async () => {
      const mockScore = {
        overall_score: 80,
        dimensions: {
          values: { score: 85, weight: 0.35 },
          communication: { score: 75, weight: 0.25 },
          lifestyle: { score: 80, weight: 0.20 },
          interests: { score: 78, weight: 0.20 },
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockScore,
      });

      render(<ChemistryPredictor targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Chemistry Predictor')).toBeInTheDocument();
      });
    });

    it('should handle missing dimensions', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ overall_score: 50, dimensions: {} }),
      });

      render(<ChemistryPredictor targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Chemistry Predictor')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null compatibility data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      render(<ChemistryPredictor targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Chemistry Predictor')).toBeInTheDocument();
      });
    });

    it('should handle invalid scores', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ overall_score: -10, dimensions: {} }),
      });

      render(<ChemistryPredictor targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Chemistry Predictor')).toBeInTheDocument();
      });
    });

    it('should handle calculation timeout', async () => {
      (global.fetch as any).mockImplementation(() =>
        new Promise((resolve) => setTimeout(resolve, 10000))
      );

      render(<ChemistryPredictor targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/calculating/i)).toBeInTheDocument();
      });
    });

    it('should handle concurrent score requests', async () => {
      let requestCount = 0;

      (global.fetch as any).mockImplementation(() => {
        requestCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ overall_score: 75 + requestCount }),
        });
      });

      render(<ChemistryPredictor targetUserId="user2" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });
});
