/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoiceProfile from '../components/VoiceProfile';

// Mock fetch
global.fetch = vi.fn();

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  state: 'inactive',
  ondataavailable: null,
  onstop: null,
};

global.MediaRecorder = vi.fn(() => mockMediaRecorder) as any;

// Mock getUserMedia
global.navigator.mediaDevices = {
  getUserMedia: vi.fn(() =>
    Promise.resolve({
      getTracks: () => [{ stop: vi.fn() }],
    })
  ),
} as any;

describe('VoiceProfile Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  describe('Recording Mode (Own Profile)', () => {
    it('should show recording prompt when no voice profile exists', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ has_recording: false }),
      });

      render(<VoiceProfile />);

      await waitFor(() => {
        expect(screen.getByText(/Record Your Voice Intro/i)).toBeInTheDocument();
      });
    });

    it('should show existing voice profile', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          has_recording: true,
          audio_url: 'https://example.com/audio.webm',
          duration: 15,
        }),
      });

      render(<VoiceProfile />);

      await waitFor(() => {
        expect(screen.getByText(/Your Voice Intro/i)).toBeInTheDocument();
        expect(screen.getByText('15 seconds')).toBeInTheDocument();
      });
    });

    it('should start recording when button clicked', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ has_recording: false }),
      });

      render(<VoiceProfile />);

      await waitFor(() => {
        expect(screen.getByText(/Record Your Voice Intro/i)).toBeInTheDocument();
      });

      const startButton = screen.getByRole('button', { name: /Start Recording/i });
      await userEvent.click(startButton);

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(mockMediaRecorder.start).toHaveBeenCalled();
    });

    it('should handle microphone access denial', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ has_recording: false }),
      });

      (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(
        new Error('Permission denied')
      );

      render(<VoiceProfile />);

      await waitFor(() => {
        expect(screen.getByText(/Record Your Voice Intro/i)).toBeInTheDocument();
      });

      const startButton = screen.getByRole('button', { name: /Start Recording/i });
      await userEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Microphone access denied/i)).toBeInTheDocument();
      });
    });

    it('should upload recording after stop', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ has_recording: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            has_recording: true,
            audio_url: 'https://example.com/audio.webm',
            duration: 10,
          }),
        });

      render(<VoiceProfile />);

      await waitFor(() => {
        expect(screen.getByText(/Record Your Voice Intro/i)).toBeInTheDocument();
      });

      // Start recording
      const startButton = screen.getByRole('button', { name: /Start Recording/i });
      await userEvent.click(startButton);

      // Simulate recording data
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const mockEvent = { data: mockBlob };
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable(mockEvent);
      }

      // Stop recording
      const stopButton = await screen.findByRole('button', { name: /Stop Recording/i });
      await userEvent.click(stopButton);

      // Upload
      const saveButton = await screen.findByRole('button', { name: /Save Voice Profile/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/voice/upload',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('should delete voice profile', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            has_recording: true,
            audio_url: 'https://example.com/audio.webm',
            duration: 15,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Voice profile deleted' }),
        });

      render(<VoiceProfile />);

      await waitFor(() => {
        expect(screen.getByText(/Your Voice Intro/i)).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/voice/me',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });
  });

  describe('View Mode (Other User Profile)', () => {
    it('should show voice profile for other user', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          has_recording: true,
          audio_url: 'https://example.com/audio.webm',
          duration: 20,
        }),
      });

      render(<VoiceProfile userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText(/Voice Intro/i)).toBeInTheDocument();
        expect(screen.getByText('20 seconds')).toBeInTheDocument();
      });
    });

    it('should show no voice profile message', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ has_recording: false }),
      });

      render(<VoiceProfile userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText(/No Voice Intro Yet/i)).toBeInTheDocument();
      });
    });

    it('should send reaction to voice profile', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            has_recording: true,
            audio_url: 'https://example.com/audio.webm',
            duration: 20,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Reaction sent!' }),
        });

      render(<VoiceProfile userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText(/Voice Intro/i)).toBeInTheDocument();
      });

      const heartButton = screen.getAllByRole('button')[1]; // Heart reaction button
      await userEvent.click(heartButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/voice/react/user123',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('should fetch and display stats', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            has_recording: true,
            audio_url: 'https://example.com/audio.webm',
            duration: 20,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            has_recording: true,
            total_plays: 100,
            unique_listeners: 50,
            play_count: 10,
            reactions: [
              { reaction_type: 'heart', count: '25' },
              { reaction_type: 'fire', count: '15' },
            ],
          }),
        });

      render(<VoiceProfile userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText(/Voice Intro/i)).toBeInTheDocument();
      });

      const statsButton = screen.getByRole('button', { name: /View Stats/i });
      await userEvent.click(statsButton);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument(); // Total plays
        expect(screen.getByText('50')).toBeInTheDocument(); // Unique listeners
      });
    });
  });

  describe('Error Handling', () => {
    it('should display upload error', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ has_recording: false }),
        })
        .mockRejectedValueOnce(new Error('Upload failed'));

      render(<VoiceProfile />);

      await waitFor(() => {
        expect(screen.getByText(/Record Your Voice Intro/i)).toBeInTheDocument();
      });

      // Start and stop recording to get to upload state
      const startButton = screen.getByRole('button', { name: /Start Recording/i });
      await userEvent.click(startButton);

      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const mockEvent = { data: mockBlob };
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable(mockEvent);
      }

      const stopButton = await screen.findByRole('button', { name: /Stop Recording/i });
      await userEvent.click(stopButton);

      const saveButton = await screen.findByRole('button', { name: /Save Voice Profile/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Profile Completion Callback', () => {
    it('should call onProfileComplete callback', async () => {
      const onProfileComplete = vi.fn();

      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ has_recording: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            has_recording: true,
            audio_url: 'https://example.com/audio.webm',
            duration: 10,
          }),
        });

      render(<VoiceProfile onProfileComplete={onProfileComplete} />);

      await waitFor(() => {
        expect(screen.getByText(/Record Your Voice Intro/i)).toBeInTheDocument();
      });

      // Start recording
      const startButton = screen.getByRole('button', { name: /Start Recording/i });
      await userEvent.click(startButton);

      // Simulate recording complete
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const mockEvent = { data: mockBlob };
      if (mockMediaRecorder.ondataavailable) {
        mockMediaRecorder.ondataavailable(mockEvent);
      }

      // Stop and upload
      const stopButton = await screen.findByRole('button', { name: /Stop Recording/i });
      await userEvent.click(stopButton);

      const saveButton = await screen.findByRole('button', { name: /Save Voice Profile/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(onProfileComplete).toHaveBeenCalled();
      });
    });
  });
});
