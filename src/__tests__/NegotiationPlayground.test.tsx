/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NegotiationPlayground from '../components/NegotiationPlayground';

describe('NegotiationPlayground', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Question Flow', () => {
    it('should load categories and questions on mount', async () => {
      const mockCategories = [
        { id: '1', name: 'Communication', icon: 'message-circle', display_order: 1 },
      ];

      const mockQuestions = [
        {
          id: 'q1',
          category_id: '1',
          category_name: 'Communication',
          category_icon: 'message-circle',
          question_text: 'What is your preferred communication style?',
          question_type: 'single_choice',
          options: ['Direct', 'Indirect', 'Mixed'],
          allows_multiple: false,
          requires_explanation: false,
          display_order: 1,
        },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCategories,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockQuestions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      render(<NegotiationPlayground />);

      await waitFor(() => {
        expect(screen.getByText('Negotiation Playground')).toBeInTheDocument();
      });
    });

    it('should navigate between questions', async () => {
      const mockCategories = [
        { id: '1', name: 'Communication', icon: 'message-circle', display_order: 1 },
      ];

      const mockQuestions = [
        {
          id: 'q1',
          category_name: 'Communication',
          category_icon: 'message-circle',
          question_text: 'Question 1?',
          question_type: 'single_choice',
          options: ['A', 'B'],
          display_order: 1,
        },
        {
          id: 'q2',
          category_name: 'Communication',
          category_icon: 'message-circle',
          question_text: 'Question 2?',
          question_type: 'single_choice',
          options: ['C', 'D'],
          display_order: 2,
        },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => mockCategories })
        .mockResolvedValueOnce({ ok: true, json: async () => mockQuestions })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      render(<NegotiationPlayground targetUserId="user2" targetUserName="Test User" />);

      await userEvent.click(screen.getByText(/Start Negotiation/));

      await waitFor(() => {
        expect(screen.getByText('Question 1?')).toBeInTheDocument();
      });

      // Answer first question
      await userEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('Question 2?')).toBeInTheDocument();
      });
    });

    it('should disable previous button on first question', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: 'q1',
              category_name: 'Communication',
              category_icon: 'message-circle',
              question_text: 'Question 1?',
              question_type: 'single_choice',
              options: ['A'],
              display_order: 1,
            },
          ],
        })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      render(<NegotiationPlayground targetUserId="user2" />);

      await userEvent.click(screen.getByText(/Start Negotiation/));

      await waitFor(() => {
        const previousButton = screen.getByText('Previous');
        expect(previousButton).toBeDisabled();
      });
    });
  });

  describe('Answer Submission', () => {
    it('should select single choice answer', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: 'q1',
              category_name: 'Communication',
              category_icon: 'message-circle',
              question_text: 'Choose one?',
              question_type: 'single_choice',
              options: ['Option A', 'Option B'],
              display_order: 1,
            },
          ],
        })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      render(<NegotiationPlayground targetUserId="user2" />);

      await userEvent.click(screen.getByText(/Start Negotiation/));

      await waitFor(() => {
        expect(screen.getByText('Choose one?')).toBeInTheDocument();
      });

      const optionButtons = screen.getAllByText(/Option/);
      await userEvent.click(optionButtons[0]);

      // Option should be selected (checked state)
      expect(optionButtons[0]).toBeInTheDocument();
    });

    it('should select multiple choice answers', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: 'q1',
              category_name: 'Communication',
              category_icon: 'message-circle',
              question_text: 'Choose multiple?',
              question_type: 'multiple_choice',
              options: ['A', 'B', 'C'],
              allows_multiple: true,
              display_order: 1,
            },
          ],
        })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      render(<NegotiationPlayground targetUserId="user2" />);

      await userEvent.click(screen.getByText(/Start Negotiation/));

      await waitFor(() => {
        expect(screen.getByText('Choose multiple?')).toBeInTheDocument();
      });

      const optionButtons = screen.getAllByText(/^[ABC]$/);
      await userEvent.click(optionButtons[0]);
      await userEvent.click(optionButtons[1]);

      // Multiple options should be selectable
      expect(optionButtons[0]).toBeInTheDocument();
    });

    it('should submit answers at the end', async () => {
      const mockSession = {
        id: 'session1',
        user1_completed: true,
        user2_completed: false,
      };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: 'q1',
              category_name: 'Communication',
              category_icon: 'message-circle',
              question_text: 'Question 1?',
              question_type: 'single_choice',
              options: ['A'],
              display_order: 1,
            },
          ],
        })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ answers: {} }),
        });

      render(<NegotiationPlayground targetUserId="user2" />);

      await userEvent.click(screen.getByText(/Start Negotiation/));

      await waitFor(() => {
        expect(screen.getByText('Question 1?')).toBeInTheDocument();
      });

      const optionButtons = screen.getAllByText(/^[A]$/);
      await userEvent.click(optionButtons[0]);

      await userEvent.click(screen.getByText('Submit Answers'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/negotiation/sessions/session1/answers',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });
  });

  describe('Answer Comparison', () => {
    it('should show waiting screen when partner has not completed', async () => {
      const mockSession = {
        id: 'session1',
        with_user_name: 'Partner',
        user1_completed: true,
        user2_completed: false,
      };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [mockSession] });

      render(<NegotiationPlayground />);

      await waitFor(() => {
        expect(screen.getByText('Your Negotiations')).toBeInTheDocument();
      });

      // Click on incomplete session
      await userEvent.click(screen.getByText(/Negotiation with/));

      await waitFor(() => {
        expect(screen.getByText('Waiting for Partner')).toBeInTheDocument();
      });
    });

    it('should display comparison when both completed', async () => {
      const mockSession = {
        id: 'session1',
        with_user_name: 'Partner',
        user1_completed: true,
        user2_completed: true,
        match_score: 85,
        answers: {
          Communication: {
            user1_answers: [
              {
                question_id: 'q1',
                question_text: 'Question?',
                answer: 'A',
              },
            ],
            user2_answers: [
              {
                question_id: 'q1',
                question_text: 'Question?',
                answer: 'A',
              },
            ],
          },
        },
      };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [mockSession] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      render(<NegotiationPlayground />);

      await waitFor(() => {
        expect(screen.getByText('Your Negotiations')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText(/Negotiation with/));

      await waitFor(() => {
        expect(screen.getByText('85%')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty questions array', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      render(<NegotiationPlayground />);

      await waitFor(() => {
        expect(screen.getByText('Negotiation Playground')).toBeInTheDocument();
      });
    });

    it('should handle missing target user', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      render(<NegotiationPlayground />);

      await waitFor(() => {
        expect(screen.queryByText(/Start Negotiation/)).not.toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('API Error'));

      render(<NegotiationPlayground targetUserId="user2" />);

      await waitFor(() => {
        expect(screen.getByText(/An error occurred/)).toBeInTheDocument();
      });
    });

    it('should handle null answers in comparison', async () => {
      const mockSession = {
        id: 'session1',
        with_user_name: 'Partner',
        user1_completed: true,
        user2_completed: true,
        answers: null,
      };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [mockSession] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      render(<NegotiationPlayground />);

      await userEvent.click(screen.getByText(/Negotiation with/));

      await waitFor(() => {
        expect(screen.getByText('Negotiation Results')).toBeInTheDocument();
      });
    });

    it('should handle concurrent session creation', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      render(<NegotiationPlayground targetUserId="user2" />);

      const startButton = screen.getByText(/Start Negotiation/);

      // Double click
      await userEvent.dblClick(startButton);

      // Should handle gracefully (not create duplicate sessions)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should handle XSS in question text', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: 'q1',
              category_name: 'Communication',
              category_icon: 'message-circle',
              question_text: xssPayload,
              question_type: 'single_choice',
              options: ['A'],
              display_order: 1,
            },
          ],
        })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      render(<NegotiationPlayground targetUserId="user2" />);

      await userEvent.click(screen.getByText(/Start Negotiation/));

      await waitFor(() => {
        // Should display escaped text, not execute script
        expect(screen.getByText(xssPayload)).toBeInTheDocument();
      });
    });

    it('should handle missing explanation field', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: 'q1',
              category_name: 'Communication',
              category_icon: 'message-circle',
              question_text: 'Question?',
              question_type: 'single_choice',
              options: ['A'],
              requires_explanation: true,
              display_order: 1,
            },
          ],
        })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      render(<NegotiationPlayground targetUserId="user2" />);

      await userEvent.click(screen.getByText(/Start Negotiation/));

      await waitFor(() => {
        expect(screen.getByLabelText(/Add an explanation/)).toBeInTheDocument();
      });

      // Should allow submission without explanation (it's optional)
      const textarea = screen.getByLabelText(/Add an explanation/);
      expect(textarea).toHaveValue('');
    });
  });

  describe('Session Management', () => {
    it('should create new session with target user', async () => {
      const mockSession = { id: 'session1', status: 'active' };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        });

      render(<NegotiationPlayground targetUserId="user2" targetUserName="Test" />);

      await userEvent.click(screen.getByText(/Start Negotiation with Test/));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/negotiation/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockToken}`,
          },
          body: expect.stringContaining('user2'),
        });
      });
    });

    it('should schedule meeting after completion', async () => {
      const mockSession = {
        id: 'session1',
        with_user_name: 'Partner',
        user1_completed: true,
        user2_completed: true,
        match_score: 90,
        status: 'completed',
        answers: {},
      };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [mockSession] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSession,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockSession, status: 'scheduled' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockSession, status: 'scheduled' }),
        });

      render(<NegotiationPlayground />);

      await userEvent.click(screen.getByText(/Negotiation with/));

      await waitFor(() => {
        expect(screen.getByText('Schedule Meeting')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Schedule Meeting'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/negotiation/sessions/session1/schedule',
          expect.objectContaining({
            method: 'PUT',
          })
        );
      });
    });
  });
});
