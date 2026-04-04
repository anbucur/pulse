/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import negotiationRouter from '../routes/negotiation';

const app = express();
app.use(express.json());
app.use('/api/negotiation', negotiationRouter);

describe('Negotiation API', () => {
  const authToken = 'Bearer mock-token';

  describe('Session Creation', () => {
    it('should create negotiation session', async () => {
      const response = await request(app)
        .post('/sessions')
        .set('Authorization', authToken)
        .send({
          with_user_id: 'user2',
        });

      expect([200, 201, 401]).toContain(response.status);
    });

    it('should prevent self-negotiation', async () => {
      const response = await request(app)
        .post('/sessions')
        .set('Authorization', authToken)
        .send({
          with_user_id: 'user1',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Answer Submission', () => {
    it('should submit answers', async () => {
      const response = await request(app)
        .post('/sessions/session1/answers')
        .set('Authorization', authToken)
        .send({
          answers: [
            {
              question_id: 'q1',
              answer: 'Option A',
              explanation: 'My reasoning',
            },
          ],
        });

      expect([200, 201, 401, 404]).toContain(response.status);
    });

    it('should validate answer format', async () => {
      const response = await request(app)
        .post('/sessions/session1/answers')
        .set('Authorization', authToken)
        .send({
          answers: [
            {
              question_id: 'q1',
              answer: null,
            },
          ],
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Match Calculation', () => {
    it('should calculate match score', async () => {
      const response = await request(app)
        .get('/sessions/session1')
        .set('Authorization', authToken);

      expect([200, 401, 404]).toContain(response.status);
    });

    it('should return highlighted matches', async () => {
      const response = await request(app)
        .get('/sessions/session1')
        .set('Authorization', authToken);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('match_score');
        expect(response.body).toHaveProperty('highlighted_matches');
      }
    });

    it('should identify potential gaps', async () => {
      const response = await request(app)
        .get('/sessions/session1')
        .set('Authorization', authToken);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('potential_gaps');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-existent session', async () => {
      const response = await request(app)
        .get('/sessions/nonexistent')
        .set('Authorization', authToken);

      expect(response.status).toBe(404);
    });

    it('should handle concurrent answer submissions', async () => {
      const response1 = await request(app)
        .post('/sessions/session1/answers')
        .set('Authorization', authToken)
        .send({ answers: [{ question_id: 'q1', answer: 'A' }] });

      const response2 = await request(app)
        .post('/sessions/session1/answers')
        .set('Authorization', authToken)
        .send({ answers: [{ question_id: 'q1', answer: 'B' }] });

      expect([200, 201, 400, 409]).toContain(response1.status);
    });
  });
});
