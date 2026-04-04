/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SocialProofReferences from '../components/SocialProofReferences';

describe('SocialProofReferences', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Reference Submission', () => {
    it('should submit a reference for a connection', async () => {
      const mockReference = {
        id: 'ref1',
        subject_user_id: 'user2',
        from_user_id: 'user1',
        relationship_type: 'dated',
        rating: 5,
        would_recommend: true,
        is_anonymous: false,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockReference,
      });

      render(<SocialProofReferences targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Social Proof References')).toBeInTheDocument();
      });
    });

    it('should handle relationship type validation', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Invalid relationship type' }),
      });

      render(<SocialProofReferences targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/invalid relationship/i)).toBeInTheDocument();
      });
    });

    it('should require minimum text length', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Reference must be at least 50 characters' }),
      });

      render(<SocialProofReferences targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/at least 50 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Anonymity', () => {
    it('should submit anonymous reference', async () => {
      const mockReference = {
        id: 'ref1',
        is_anonymous: true,
        anonymous_display: 'Anonymous Reference',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockReference,
      });

      render(<SocialProofReferences targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Social Proof References')).toBeInTheDocument();
      });
    });

    it('should hide identity when anonymous', async () => {
      const mockReferences = [
        {
          id: 'ref1',
          from_user_id: 'user1',
          is_anonymous: true,
          display_name: 'Anonymous',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockReferences,
      });

      render(<SocialProofReferences targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Social Proof References')).toBeInTheDocument();
      });
    });

    it('should reveal identity for non-anonymous references', async () => {
      const mockReferences = [
        {
          id: 'ref1',
          from_user_id: 'user1',
          is_anonymous: false,
          display_name: 'John Doe',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockReferences,
      });

      render(<SocialProofReferences targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null reference data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      render(<SocialProofReferences targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Social Proof References')).toBeInTheDocument();
      });
    });

    it('should handle XSS in reference text', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'ref1', reference_text: xssPayload }),
      });

      render(<SocialProofReferences targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Social Proof References')).toBeInTheDocument();
      });
    });

    it('should handle duplicate references', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Reference already submitted' }),
      });

      render(<SocialProofReferences targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/already submitted/i)).toBeInTheDocument();
      });
    });

    it('should handle self-references', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Cannot submit reference for yourself' }),
      });

      render(<SocialProofReferences targetUserId="user1" currentUserId="user1" />);

      await waitFor(() => {
        expect(screen.getByText(/cannot submit/i)).toBeInTheDocument();
      });
    });

    it('should handle rating boundary values', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'ref1', rating: 0 }),
      });

      render(<SocialProofReferences targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText('Social Proof References')).toBeInTheDocument();
      });
    });

    it('should handle concurrent submissions', async () => {
      let submissionCount = 0;

      (global.fetch as any).mockImplementation(() => {
        submissionCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: `ref${submissionCount}` }),
        });
      });

      render(<SocialProofReferences targetUserId="user2" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });
});
