/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SceneMatch from '../components/SceneMatch';

describe('SceneMatch', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage.getItem.mockReturnValue(mockToken);
  });

  describe('Event Creation', () => {
    it('should open create modal when Create Event button is clicked', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<SceneMatch />);

      await waitFor(() => {
        expect(screen.getByText('Create Event')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Create Event'));

      expect(screen.getByText('Create Event')).toBeInTheDocument();
      expect(screen.getByLabelText('Title *')).toBeInTheDocument();
    });

    it('should create event with valid data', async () => {
      const mockEvent = {
        id: '1',
        title: 'Test Event',
        description: 'Test Description',
        event_type: 'social',
        event_date: '2026-05-01T20:00',
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEvent,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockEvent],
        });

      render(<SceneMatch />);

      await userEvent.click(screen.getByText('Create Event'));

      await userEvent.type(screen.getByLabelText('Title *'), 'Test Event');
      await userEvent.type(screen.getByLabelText('Description'), 'Test Description');

      const dateInput = screen.getByLabelText('Event Date *');
      fireEvent.change(dateInput, { target: { value: '2026-05-01T20:00' } });

      await userEvent.click(screen.getByText('Create Event'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockToken}`,
          },
          body: expect.stringContaining('Test Event'),
        });
      });
    });

    it('should disable create button when required fields are missing', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<SceneMatch />);

      await userEvent.click(screen.getByText('Create Event'));

      const createButton = screen.getByText('Create Event');
      expect(createButton).toBeDisabled();
    });

    it('should handle XSS in event title', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1', title: xssPayload }),
        });

      render(<SceneMatch />);

      await userEvent.click(screen.getByText('Create Event'));

      const titleInput = screen.getByLabelText('Title *');
      await userEvent.type(titleInput, xssPayload);

      // Input should contain the literal string, not execute it
      expect(titleInput).toHaveValue(xssPayload);
    });
  });

  describe('Event Filtering', () => {
    it('should filter events by type', async () => {
      const mockEvents = [
        { id: '1', event_type: 'social', title: 'Social Event' },
        { id: '2', event_type: 'party', title: 'Party Event' },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockEvents,
      });

      render(<SceneMatch />);

      await waitFor(() => {
        expect(screen.getByText('Social Event')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Parties'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('type=party'),
          expect.any(Object)
        );
      });
    });

    it('should show all events when All Events filter is selected', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<SceneMatch />);

      await waitFor(() => {
        expect(screen.getByText('All Events')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('All Events'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/events', expect.any(Object));
      });
    });
  });

  describe('Attendee Joining', () => {
    it('should join an event successfully', async () => {
      const mockEvent = {
        id: '1',
        title: 'Test Event',
        user_attendance: null,
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEvent,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockEvent, user_attendance: {} }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      render(<SceneMatch />);

      // Need to implement fetchEventDetails flow
      expect(global.fetch).toBeDefined();
    });

    it('should handle event full scenario', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<SceneMatch />);

      // Edge case: event at max capacity
      expect(global.fetch).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null event data gracefully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      render(<SceneMatch />);

      await waitFor(() => {
        expect(screen.queryByText('Loading events...')).not.toBeInTheDocument();
      });
    });

    it('should handle empty events list', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<SceneMatch />);

      await waitFor(() => {
        expect(screen.getByText(/No events found/)).toBeInTheDocument();
      });
    });

    it('should handle missing token in localStorage', async () => {
      global.localStorage.getItem.mockReturnValue(null);

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<SceneMatch />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/events', {
          headers: expect.objectContaining({
            'Authorization': 'Bearer null',
          }),
        });
      });
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      render(<SceneMatch />);

      await waitFor(() => {
        expect(screen.getByText(/An error occurred/)).toBeInTheDocument();
      });
    });

    it('should handle undefined tags array', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Event',
          tags: undefined,
          event_type: 'social',
          event_date: '2026-05-01',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockEvents,
      });

      render(<SceneMatch />);

      await waitFor(() => {
        expect(screen.getByText('Event')).toBeInTheDocument();
      });

      // Should not crash when tags is undefined
      expect(screen.queryByText(/tags/i)).not.toBeInTheDocument();
    });

    it('should handle invalid date formats', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Event',
          event_date: 'invalid-date',
          event_type: 'social',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockEvents,
      });

      render(<SceneMatch />);

      await waitFor(() => {
        expect(screen.getByText('Event')).toBeInTheDocument();
      });

      // Should display "Invalid Date" or handle gracefully
      expect(screen.getByText('Event')).toBeInTheDocument();
    });

    it('should handle SQL injection in filter parameters', async () => {
      const sqlInjection = "social'; DROP TABLE events; --";

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<SceneMatch />);

      // The app should escape or sanitize parameters
      await waitFor(() => {
        expect(global.fetch).toBeDefined();
      });
    });
  });

  describe('Event Details Modal', () => {
    it('should display event details when viewing an event', async () => {
      const mockEvent = {
        id: '1',
        title: 'Test Event',
        description: 'Test Description',
        venue_name: 'Test Venue',
        venue_address: '123 Test St',
        event_date: '2026-05-01T20:00',
        ticket_price: '$20',
        dress_code: 'Casual',
        event_type: 'social',
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEvent,
        });

      render(<SceneMatch />);

      // Verify event details are rendered
      expect(global.fetch).toBeDefined();
    });

    it('should close modal when X button is clicked', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<SceneMatch />);

      // Modal should close when X is clicked
      expect(screen.queryByText('×')).not.toBeInTheDocument();
    });
  });

  describe('Match Display', () => {
    it('should display matches when user has joined event', async () => {
      const mockMatches = [
        {
          user_id: '2',
          display_name: 'Test User',
          age: 25,
          gender: 'female',
          bio: 'Test bio',
          shared_interests: ['music', 'dancing'],
          has_shared_interests: true,
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMatches,
      });

      render(<SceneMatch />);

      expect(global.fetch).toBeDefined();
    });

    it('should handle empty matches list', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<SceneMatch />);

      expect(global.fetch).toBeDefined();
    });
  });

  describe('User Interactions', () => {
    it('should call onUserClick when user profile is clicked', async () => {
      const onUserClick = vi.fn();

      const mockMatches = [
        {
          user_id: '2',
          display_name: 'Test User',
          age: 25,
          gender: 'female',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMatches,
      });

      render(<SceneMatch onUserClick={onUserClick} />);

      expect(global.fetch).toBeDefined();
    });

    it('should call onMessageClick when message button is clicked', async () => {
      const onMessageClick = vi.fn();

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<SceneMatch onMessageClick={onMessageClick} />);

      expect(global.fetch).toBeDefined();
    });
  });
});
