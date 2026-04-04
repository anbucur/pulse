/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIConvoStarters from '../components/AIConvoStarters';

// Mock fetch
global.fetch = jest.fn();

describe('AIConvoStarters Component', () => {
  const mockMatchId = 123;
  const mockOnSendMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    localStorage.removeItem('token');
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

      render(<AIConvoStarters matchId={mockMatchId} />);

      expect(screen.getByText(/generating conversation starters/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message on fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      render(<AIConvoStarters matchId={mockMatchId} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to generate/i)).toBeInTheDocument();
      });
    });

    it('should allow retry on error', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: '1',
            match_id: mockMatchId,
            shared_interests: ['music'],
            conversation_prompts: ['Test prompt'],
            fun_questions: ['Test question'],
            deep_questions: ['Test deep'],
            compatibility_insights: ['Test insight'],
            generated_at: new Date().toISOString(),
          }),
        });

      render(<AIConvoStarters matchId={mockMatchId} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to generate/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/try again/i);
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Success State', () => {
    const mockStarters = {
      id: '1',
      match_id: mockMatchId,
      shared_interests: ['music', 'travel'],
      conversation_prompts: [
        'I noticed we both like music! What got you into that?',
        'Since we both like music, what is your favorite way to enjoy it?',
      ],
      fun_questions: [
        'What is the most spontaneous thing you have done recently?',
      ],
      deep_questions: [
        'What is something you are really passionate about and why?',
      ],
      compatibility_insights: [
        'You share 2 interests: music, travel',
      ],
      generated_at: new Date().toISOString(),
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockStarters,
      });
    });

    it('should display conversation starters', async () => {
      render(<AIConvoStarters matchId={mockMatchId} />);

      await waitFor(() => {
        expect(screen.getByText(/AI Conversation Starters/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/you both like: music, travel/i)).toBeInTheDocument();
    });

    it('should display all tabs', async () => {
      render(<AIConvoStarters matchId={mockMatchId} />);

      await waitFor(() => {
        expect(screen.getByText(/conversation starters/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/fun questions/i)).toBeInTheDocument();
      expect(screen.getByText(/deep questions/i)).toBeInTheDocument();
      expect(screen.getByText(/compatibility/i)).toBeInTheDocument();
    });

    it('should switch between tabs', async () => {
      render(<AIConvoStarters matchId={mockMatchId} />);

      await waitFor(() => {
        expect(screen.getByText(/conversation starters/i)).toBeInTheDocument();
      });

      const funTab = screen.getByText(/fun questions/i);
      fireEvent.click(funTab);

      expect(screen.getByText(/most spontaneous thing/i)).toBeInTheDocument();
    });

    it('should use starter when send button clicked', async () => {
      render(<AIConvoStarters matchId={mockMatchId} onSendMessage={mockOnSendMessage} />);

      await waitFor(() => {
        expect(screen.getByText(/conversation starters/i)).toBeInTheDocument();
      });

      const sendButton = screen.getAllByTitle(/send message/i)[0];
      fireEvent.click(sendButton);

      expect(mockOnSendMessage).toHaveBeenCalledWith(
        mockStarters.conversation_prompts[0]
      );
    });

    it('should copy starter to clipboard', async () => {
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      render(<AIConvoStarters matchId={mockMatchId} />);

      await waitFor(() => {
        expect(screen.getByText(/conversation starters/i)).toBeInTheDocument();
      });

      const copyButton = screen.getAllByTitle(/copy to clipboard/i)[0];
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(
          mockStarters.conversation_prompts[0]
        );
      });
    });

    it('should refresh starters', async () => {
      render(<AIConvoStarters matchId={mockMatchId} />);

      await waitFor(() => {
        expect(screen.getByText(/conversation starters/i)).toBeInTheDocument();
      });

      const refreshButton = screen.getByTitle(/refresh starters/i);
      fireEvent.click(refreshButton);

      expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + refresh
    });
  });

  describe('Feedback Modal', () => {
    const mockStarters = {
      id: '1',
      match_id: mockMatchId,
      shared_interests: [],
      conversation_prompts: ['Test prompt'],
      fun_questions: [],
      deep_questions: [],
      compatibility_insights: [],
      generated_at: new Date().toISOString(),
    };

    beforeEach(() => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStarters,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => [],
        });
    });

    it('should show feedback modal after using starter', async () => {
      render(<AIConvoStarters matchId={mockMatchId} onSendMessage={mockOnSendMessage} />);

      await waitFor(() => {
        expect(screen.getByText(/conversation starters/i)).toBeInTheDocument();
      });

      const sendButton = screen.getAllByTitle(/send message/i)[0];
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/was this helpful\?/i)).toBeInTheDocument();
      });
    });

    it('should submit feedback', async () => {
      render(<AIConvoStarters matchId={mockMatchId} onSendMessage={mockOnSendMessage} />);

      await waitFor(() => {
        expect(screen.getByText(/conversation starters/i)).toBeInTheDocument();
      });

      // Open modal
      const sendButton = screen.getAllByTitle(/send message/i)[0];
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/was this helpful\?/i)).toBeInTheDocument();
      });

      // Submit positive feedback
      const positiveButton = screen.getByText(/yes, it started a conversation/i);
      fireEvent.click(positiveButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/feedback/'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });
  });
});
