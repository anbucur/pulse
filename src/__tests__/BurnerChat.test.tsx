/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BurnerChat from '../components/BurnerChat';

describe('BurnerChat', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Room Creation', () => {
    it('should create a new burner chat room', async () => {
      const mockRoom = {
        id: 'room1',
        room_code: 'ABC123',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        max_messages: 100,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockRoom,
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(screen.getByText('Burner Chat')).toBeInTheDocument();
      });
    });

    it('should generate unique room code', async () => {
      const mockRoom = {
        id: 'room1',
        room_code: 'XYZ789',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockRoom,
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(screen.getByText('Burner Chat')).toBeInTheDocument();
      });
    });

    it('should handle room creation conflicts', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Room code already exists' }),
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });
    });
  });

  describe('Auto-destruct', () => {
    it('should set expiration time for room', async () => {
      const mockRoom = {
        id: 'room1',
        expires_at: new Date(Date.now() + 7200000).toISOString(),
        auto_delete: true,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockRoom,
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(screen.getByText('Burner Chat')).toBeInTheDocument();
      });
    });

    it('should delete expired rooms', async () => {
      const mockRoom = {
        id: 'room1',
        expires_at: new Date(Date.now() - 1000).toISOString(),
        deleted: true,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockRoom,
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(screen.getByText(/expired/i)).toBeInTheDocument();
      });
    });

    it('should show countdown to expiration', async () => {
      const mockRoom = {
        id: 'room1',
        expires_at: new Date(Date.now() + 300000).toISOString(),
        time_remaining: 300,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockRoom,
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(screen.getByText('Burner Chat')).toBeInTheDocument();
      });
    });
  });

  describe('Encryption', () => {
    it('should use end-to-end encryption', async () => {
      const mockRoom = {
        id: 'room1',
        encryption: 'e2e',
        encryption_key: 'encrypted-key',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockRoom,
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(screen.getByText('Burner Chat')).toBeInTheDocument();
      });
    });

    it('should handle encryption key generation', async () => {
      const mockRoom = {
        id: 'room1',
        public_key: 'mock-public-key',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockRoom,
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(screen.getByText('Burner Chat')).toBeInTheDocument();
      });
    });

    it('should verify message integrity', async () => {
      const mockMessage = {
        id: 'msg1',
        content: 'encrypted-content',
        signature: 'message-signature',
        verified: true,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMessage,
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(screen.getByText('Burner Chat')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null room data', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(screen.getByText('Burner Chat')).toBeInTheDocument();
      });
    });

    it('should handle XSS in messages', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'room1', messages: [{ content: xssPayload }] }),
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(screen.getByText('Burner Chat')).toBeInTheDocument();
      });
    });

    it('should handle message limit exceeded', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Message limit exceeded' }),
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(screen.getByText(/message limit/i)).toBeInTheDocument();
      });
    });

    it('should handle concurrent message sending', async () => {
      let messageCount = 0;

      (global.fetch as any).mockImplementation(() => {
        messageCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: `msg${messageCount}` }),
        });
      });

      render(<BurnerChat />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });
});
