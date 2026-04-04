/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import request from 'supertest';
import { pool } from '../config/index.js';
import { generateToken } from '../utils/jwt.js';

describe('Slow Dating API', () => {
  let authToken: string;
  let userId: number;
  let testUserId: number;

  beforeAll(async () => {
    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, is_verified)
       VALUES ($1, $2, true)
       RETURNING id`,
      ['slowdating@test.com', 'hash']
    );
    userId = userResult.rows[0].id;
    authToken = generateToken(userId);

    // Create a profile
    await pool.query(
      `INSERT INTO profiles (user_id, display_name, age, gender, interests, location)
       VALUES ($1, 'Test User', 28, 'non-binary', ARRAY['music', 'travel', 'art'], 'San Francisco')`,
      [userId]
    );

    // Create another user for matching
    const matchUserResult = await pool.query(
      `INSERT INTO users (email, password_hash, is_verified)
       VALUES ($1, $2, true)
       RETURNING id`,
      ['matchcandidate@test.com', 'hash']
    );
    testUserId = matchUserResult.rows[0].id;

    await pool.query(
      `INSERT INTO profiles (user_id, display_name, age, gender, interests, location)
       VALUES ($1, 'Match Candidate', 26, 'female', ARRAY['music', 'art', 'photography'], 'San Francisco')`,
      [testUserId]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM slowdating_responses WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM slowdating_daily_matches WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM slowdating_preferences WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM profiles WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.query('DELETE FROM profiles WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  });

  describe('GET /api/slowdating/daily', () => {
    it('should return empty array when no matches exist', async () => {
      const response = await request(app)
        .get('/api/slowdating/daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matches');
      expect(Array.isArray(response.body.matches)).toBe(true);
    });

    it('should generate daily matches', async () => {
      const response = await request(app)
        .get('/api/slowdating/daily')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matches');
      expect(response.body).toHaveProperty('date');
      expect(Array.isArray(response.body.matches)).toBe(true);
    });
  });

  describe('GET /api/slowdating/preferences', () => {
    it('should get or create user preferences', async () => {
      const response = await request(app)
        .get('/api/slowdating/preferences')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user_id', userId);
      expect(response.body).toHaveProperty('daily_match_count');
      expect(response.body).toHaveProperty('min_compatibility_score');
    });
  });

  describe('PUT /api/slowdating/preferences', () => {
    it('should update user preferences', async () => {
      const updateData = {
        daily_match_count: 5,
        min_compatibility_score: 80,
        preferred_age_range: { min: 25, max: 35 },
      };

      const response = await request(app)
        .put('/api/slowdating/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.daily_match_count).toBe(5);
      expect(response.body.min_compatibility_score).toBe(80);
    });
  });

  describe('POST /api/slowdating/respond/:matchId', () => {
    it('should record a pass response', async () => {
      const response = await request(app)
        .post(`/api/slowdating/respond/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ response_type: 'pass' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('response');
      expect(response.body.response.response_type).toBe('pass');
    });

    it('should record a like response', async () => {
      const response = await request(app)
        .post(`/api/slowdating/respond/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ response_type: 'like' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('response');
      expect(response.body.response.response_type).toBe('like');
    });

    it('should reject invalid response type', async () => {
      const response = await request(app)
        .post(`/api/slowdating/respond/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ response_type: 'invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/slowdating/history', () => {
    it('should return match history', async () => {
      const response = await request(app)
        .get('/api/slowdating/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('history');
      expect(Array.isArray(response.body.history)).toBe(true);
    });
  });

  describe('GET /api/slowdating/responses', () => {
    it('should return past responses', async () => {
      const response = await request(app)
        .get('/api/slowdating/responses')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
