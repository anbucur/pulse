/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import request from 'supertest';
import express, { Application } from 'express';
import { pool } from '../config/index.js';
import ghostingRoutes from '../routes/ghosting.js';

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

describe('Anti-Ghosting API', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/ghosting', ghostingRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/ghosting/pledge/:matchId', () => {
    it('should return existing pledge', async () => {
      const mockPledge = {
        id: '1',
        match_id: 123,
        user1_pledge_status: 'agreed',
        user2_pledge_status: 'pending',
        response_expectation_hours: 48,
        pledge_active: false,
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 123, user1_id: 1, user2_id: 2 }],
      });
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockPledge] });

      const response = await request(app).get('/api/ghosting/pledge/123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockPledge);
    });

    it('should create new pledge if none exists', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ id: 123, user1_id: 1, user2_id: 2 }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              match_id: 123,
              user1_id: 1,
              user2_id: 2,
              user1_pledge_status: 'pending',
              user2_pledge_status: 'pending',
            },
          ],
        });

      const response = await request(app).get('/api/ghosting/pledge/123');

      expect(response.status).toBe(200);
      expect(response.body.user1_pledge_status).toBe('pending');
    });

    it('should return 404 if match not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/ghosting/pledge/999');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/ghosting/pledge/:matchId/agree', () => {
    it('should agree to pledge', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ id: 123, user1_id: 1, user2_id: 2 }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              match_id: 123,
              user1_pledge_status: 'agreed',
              user2_pledge_status: 'pending',
              response_expectation_hours: 48,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/ghosting/pledge/123/agree')
        .send({ response_expectation_hours: 48 });

      expect(response.status).toBe(200);
      expect(response.body.user1_pledge_status).toBe('agreed');
    });

    it('should return 400 for invalid response expectation', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 123, user1_id: 1, user2_id: 2 }],
      });

      const response = await request(app)
        .post('/api/ghosting/pledge/123/agree')
        .send({ response_expectation_hours: 99 });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/ghosting/pledge/:matchId/decline', () => {
    it('should decline pledge', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ id: 123, user1_id: 1, user2_id: 2 }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).post('/api/ghosting/pledge/123/decline');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/ghosting/metrics', () => {
    it('should return user metrics', async () => {
      const mockMetrics = {
        id: '1',
        user_id: 1,
        pledges_agreed: 10,
        pledges_broken: 1,
        pledge_compliance_rate: 90,
        reliability_score: 95,
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockMetrics] });

      const response = await request(app).get('/api/ghosting/metrics');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMetrics);
    });

    it('should create metrics if none exist', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: '1', user_id: 1, pledges_agreed: 0, pledges_broken: 0 }],
        });

      const response = await request(app).get('/api/ghosting/metrics');

      expect(response.status).toBe(200);
      expect(response.body.user_id).toBe(1);
    });
  });

  describe('GET /api/ghosting/nudges', () => {
    it('should return pending nudges', async () => {
      const mockNudges = [
        {
          id: '1',
          match_id: 123,
          nudge_type: '24h_reminder',
          status: 'pending',
          scheduled_for: new Date().toISOString(),
        },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: mockNudges });

      const response = await request(app).get('/api/ghosting/nudges');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockNudges);
    });
  });

  describe('POST /api/ghosting/nudges/:matchId/trigger', () => {
    it('should trigger a manual nudge', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ id: 123, user1_id: 1, user2_id: 2 }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              match_id: 123,
              sender_id: 2,
              recipient_id: 1,
              nudge_type: 'gentle_nudge',
              status: 'sent',
            },
          ],
        });

      const response = await request(app)
        .post('/api/ghosting/nudges/123/trigger')
        .send({ nudge_type: 'gentle_nudge' });

      expect(response.status).toBe(200);
      expect(response.body.nudge_type).toBe('gentle_nudge');
    });

    it('should return 400 for invalid nudge type', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 123, user1_id: 1, user2_id: 2 }],
      });

      const response = await request(app)
        .post('/api/ghosting/nudges/123/trigger')
        .send({ nudge_type: 'invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/ghosting/last-seen', () => {
    it('should update last seen', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            user_id: 1,
            last_active_at: new Date().toISOString(),
            is_online: true,
          },
        ],
      });

      const response = await request(app)
        .post('/api/ghosting/last-seen')
        .send({ action: 'active' });

      expect(response.status).toBe(200);
      expect(response.body.is_online).toBe(true);
    });
  });

  describe('GET /api/ghosting/last-seen/:userId', () => {
    it('should return last seen for user', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            user_id: 2,
            last_active_at: new Date().toISOString(),
            is_online: true,
          },
        ],
      });

      const response = await request(app).get('/api/ghosting/last-seen/2');

      expect(response.status).toBe(200);
      expect(response.body.user_id).toBe(2);
    });

    it('should return default if no last seen record', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/ghosting/last-seen/2');

      expect(response.status).toBe(200);
      expect(response.body.is_online).toBe(false);
    });
  });

  describe('POST /api/ghosting/read-receipt/:messageId', () => {
    it('should record read receipt', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              conversation_id: 1,
              sender_id: 2,
              created_at: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              message_id: 1,
              reader_id: 1,
              read_at: new Date().toISOString(),
            },
          ],
        });

      const response = await request(app).post('/api/ghosting/read-receipt/1');

      expect(response.status).toBe(200);
      expect(response.body.reader_id).toBe(1);
    });

    it('should return 404 if message not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app).post('/api/ghosting/read-receipt/999');

      expect(response.status).toBe(404);
    });
  });
});
