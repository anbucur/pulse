/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import request from 'supertest';
import express, { Application } from 'express';
import { pool } from '../config/index.js';
import convoStartersRoutes from '../routes/convo-starters.js';
import { authenticate } from '../middleware/auth.js';

// Mock the auth middleware
jest.mock('../middleware/auth.js', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.userId = 1;
    next();
  },
  AuthRequest: {},
}));

// Mock the database
jest.mock('../config/index.js', () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe('Conversation Starters API', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/convo-starters', convoStartersRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/convo-starters/match/:matchId', () => {
    it('should return existing conversation starters', async () => {
      const mockStarters = {
        id: '1',
        match_id: 123,
        shared_interests: ['music', 'travel'],
        conversation_prompts: ['I see we both like music!'],
        fun_questions: ['What is your favorite song?'],
        deep_questions: ['What does music mean to you?'],
        compatibility_insights: ['You both love music'],
        generated_at: new Date().toISOString(),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ user1_id: 1, user2_id: 2 }],
      });
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockStarters],
      });

      const response = await request(app).get('/api/convo-starters/match/123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStarters);
    });

    it('should generate new conversation starters', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ user1_id: 1, user2_id: 2 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            { user_id: 1, interests: ['music', 'travel'], bio: 'Music lover' },
            { user_id: 2, interests: ['music', 'food'], bio: 'Foodie' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              match_id: 123,
              shared_interests: ['music'],
              conversation_prompts: ['I see we both like music!'],
              fun_questions: ['What is your favorite song?'],
              deep_questions: ['What does music mean to you?'],
              compatibility_insights: ['You both love music'],
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/convo-starters/match/123');

      expect(response.status).toBe(200);
      expect(response.body.shared_interests).toContain('music');
    });

    it('should return 404 if match not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/convo-starters/match/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/convo-starters/feedback/:starterId', () => {
    it('should submit feedback', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ id: '1', match_id: 123, user1_id: 1, user2_id: 2 }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              convo_starter_id: '1',
              user_id: 1,
              starter_type: 'prompt',
              starter_text: 'Test',
              feedback_type: 'used',
              led_to_conversation: true,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/convo-starters/feedback/1')
        .send({
          starter_type: 'prompt',
          starter_text: 'Test',
          feedback_type: 'used',
          led_to_conversation: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.feedback_type).toBe('used');
    });

    it('should return 400 for invalid starter type', async () => {
      const response = await request(app)
        .post('/api/convo-starters/feedback/1')
        .send({
          starter_type: 'invalid',
          starter_text: 'Test',
          feedback_type: 'used',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid feedback type', async () => {
      const response = await request(app)
        .post('/api/convo-starters/feedback/1')
        .send({
          starter_type: 'prompt',
          starter_text: 'Test',
          feedback_type: 'invalid',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/convo-starters/feedback/:starterId', () => {
    it('should return feedback for a starter', async () => {
      const mockFeedback = [
        {
          id: '1',
          convo_starter_id: '1',
          user_id: 1,
          starter_type: 'prompt',
          starter_text: 'Test',
          feedback_type: 'used',
        },
      ];

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ id: '1', match_id: 123, user1_id: 1, user2_id: 2 }],
        })
        .mockResolvedValueOnce({ rows: mockFeedback });

      const response = await request(app).get('/api/convo-starters/feedback/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockFeedback);
    });
  });

  describe('GET /api/convo-starters/analytics', () => {
    it('should return analytics', async () => {
      const mockAnalytics = [
        {
          id: '1',
          date: '2026-04-04',
          total_generated: 100,
          total_used: 50,
          led_to_conversation: 30,
          average_rating: 4.2,
        },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: mockAnalytics });

      const response = await request(app).get('/api/convo-starters/analytics');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAnalytics);
    });
  });
});
