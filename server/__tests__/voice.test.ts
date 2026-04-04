/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import request from 'supertest';
import { pool } from '../config/index.js';
import { generateToken } from '../utils/jwt.js';

describe('Voice Profile API', () => {
  let authToken: string;
  let userId: number;
  let testUserId: number;
  let voiceProfileId: number;

  beforeAll(async () => {
    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, is_verified)
       VALUES ($1, $2, true)
       RETURNING id`,
      ['voice@test.com', 'hash']
    );
    userId = userResult.rows[0].id;
    authToken = generateToken(userId);

    // Create profile
    await pool.query(
      `INSERT INTO profiles (user_id, display_name, age, gender)
       VALUES ($1, 'Voice User', 28, 'male')`,
      [userId]
    );

    // Create another user for viewing
    const otherUserResult = await pool.query(
      `INSERT INTO users (email, password_hash, is_verified)
       VALUES ($1, $2, true)
       RETURNING id`,
      ['voiceviewer@test.com', 'hash']
    );
    testUserId = otherUserResult.rows[0].id;

    await pool.query(
      `INSERT INTO profiles (user_id, display_name, age, gender)
       VALUES ($1, 'Voice Viewer', 26, 'female')`,
      [testUserId]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM voice_profile_reactions WHERE reactor_id = $1', [userId]);
    await pool.query('DELETE FROM voice_profile_plays WHERE listener_id = $1', [userId]);
    await pool.query('DELETE FROM voice_profiles WHERE user_id IN ($1, $2)', [userId, testUserId]);
    await pool.query('DELETE FROM profiles WHERE user_id IN ($1, $2)', [userId, testUserId]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [userId, testUserId]);
  });

  describe('GET /api/voice/me', () => {
    it('should return no recording when none exists', async () => {
      const response = await request(app)
        .get('/api/voice/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('has_recording', false);
    });

    it('should return existing voice profile', async () => {
      // Create a voice profile
      const insertResult = await pool.query(
        `INSERT INTO voice_profiles (user_id, audio_url, duration)
         VALUES ($1, 'https://example.com/audio.webm', 15)
         RETURNING id`,
        [userId]
      );
      voiceProfileId = insertResult.rows[0].id;

      const response = await request(app)
        .get('/api/voice/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('has_recording', true);
      expect(response.body).toHaveProperty('audio_url');
      expect(response.body).toHaveProperty('duration', 15);
    });
  });

  describe('POST /api/voice/upload', () => {
    const validAudioData = 'data:audio/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtAoe4DQ';

    it('should upload voice recording', async () => {
      const response = await request(app)
        .post('/api/voice/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          audio_data: validAudioData,
          duration: 20,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('audio_url');
      expect(response.body).toHaveProperty('duration', 20);
    });

    it('should reject upload without audio data', async () => {
      const response = await request(app)
        .post('/api/voice/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ duration: 10 });

      expect(response.status).toBe(400);
    });

    it('should reject invalid duration', async () => {
      const response = await request(app)
        .post('/api/voice/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          audio_data: validAudioData,
          duration: 35, // Over 30 seconds
        });

      expect(response.status).toBe(400);
    });

    it('should reject duration under 1 second', async () => {
      const response = await request(app)
        .post('/api/voice/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          audio_data: validAudioData,
          duration: 0,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/voice/:userId', () => {
    it('should get user voice profile', async () => {
      const response = await request(app)
        .get(`/api/voice/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('has_recording', true);
    });

    it('should return no recording for user without voice profile', async () => {
      const response = await request(app)
        .get(`/api/voice/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('has_recording', false);
    });
  });

  describe('DELETE /api/voice/me', () => {
    it('should delete voice profile', async () => {
      const response = await request(app)
        .delete('/api/voice/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Voice profile deleted');

      // Verify deletion
      const checkResponse = await request(app)
        .get('/api/voice/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(checkResponse.body.has_recording).toBe(false);
    });
  });

  describe('POST /api/voice/react/:voiceProfileId', () => {
    beforeAll(async () => {
      // Create a voice profile for testing reactions
      const insertResult = await pool.query(
        `INSERT INTO voice_profiles (user_id, audio_url, duration)
         VALUES ($1, 'https://example.com/audio.webm', 15)
         RETURNING id`,
        [userId]
      );
      voiceProfileId = insertResult.rows[0].id;
    });

    it('should add reaction to voice profile', async () => {
      const response = await request(app)
        .post(`/api/voice/react/${voiceProfileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reaction_type: 'heart' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Reaction recorded');
    });

    it('should reject invalid reaction type', async () => {
      const response = await request(app)
        .post(`/api/voice/react/${voiceProfileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reaction_type: 'invalid' });

      expect(response.status).toBe(400);
    });

    it('should accept all valid reaction types', async () => {
      const validReactions = ['heart', 'fire', 'laugh', 'thoughtful'];

      for (const reaction of validReactions) {
        const response = await request(app)
          .post(`/api/voice/react/${voiceProfileId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reaction_type: reaction });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('DELETE /api/voice/react/:voiceProfileId/:reactionType', () => {
    it('should remove reaction', async () => {
      const response = await request(app)
        .delete(`/api/voice/react/${voiceProfileId}/heart`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Reaction removed');
    });
  });

  describe('GET /api/voice/stats/:userId', () => {
    it('should return voice profile stats', async () => {
      const response = await request(app)
        .get(`/api/voice/stats/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total_plays');
      expect(response.body).toHaveProperty('unique_listeners');
      expect(response.body).toHaveProperty('play_count');
    });

    it('should return no recording for user without voice profile', async () => {
      const response = await request(app)
        .get(`/api/voice/stats/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('has_recording', false);
    });
  });
});
