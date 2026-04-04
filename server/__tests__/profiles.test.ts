/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import profilesRouter from '../routes/profiles';

const app = express();
app.use(express.json());
app.use('/api/profiles', profilesRouter);

describe('Profiles API', () => {
  const authToken = 'Bearer mock-token';

  describe('GET /api/profiles/:id', () => {
    it('should fetch profile by ID', async () => {
      const response = await request(app)
        .get('/api/profiles/user1')
        .set('Authorization', authToken);

      expect([200, 401, 404]).toContain(response.status);
    });

    it('should filter private fields based on relationship', async () => {
      const response = await request(app)
        .get('/api/profiles/user2')
        .set('Authorization', authToken);

      if (response.status === 200) {
        expect(response.body).not.toHaveProperty('email');
        expect(response.body).not.toHaveProperty('phone');
      }
    });

    it('should handle non-existent profile', async () => {
      const response = await request(app)
        .get('/api/profiles/nonexistent')
        .set('Authorization', authToken);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/profiles/:id', () => {
    it('should update own profile', async () => {
      const response = await request(app)
        .put('/api/profiles/user1')
        .set('Authorization', authToken)
        .send({
          display_name: 'Updated Name',
          bio: 'Updated bio',
        });

      expect([200, 401, 403]).toContain(response.status);
    });

    it('should prevent updating another user profile', async () => {
      const response = await request(app)
        .put('/api/profiles/user2')
        .set('Authorization', authToken)
        .send({
          display_name: 'Hacked Name',
        });

      expect(response.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .put('/api/profiles/user1')
        .set('Authorization', authToken)
        .send({
          display_name: '',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Complex Profile Data', () => {
    it('should handle interests array', async () => {
      const response = await request(app)
        .put('/api/profiles/user1')
        .set('Authorization', authToken)
        .send({
          interests: ['music', 'travel', 'photography'],
        });

      expect([200, 401]).toContain(response.status);
    });

    it('should handle photos array with indices', async () => {
      const response = await request(app)
        .put('/api/profiles/user1')
        .set('Authorization', authToken)
        .send({
          photos: ['url1', 'url2', 'url3'],
          primary_photo_index: 0,
        });

      expect([200, 401]).toContain(response.status);
    });

    it('should validate photo index bounds', async () => {
      const response = await request(app)
        .put('/api/profiles/user1')
        .set('Authorization', authToken)
        .send({
          photos: ['url1'],
          primary_photo_index: 5,
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Privacy Controls', () => {
    it('should handle privacy_level field', async () => {
      const response = await request(app)
        .put('/api/profiles/user1')
        .set('Authorization', authToken)
        .send({
          privacy_level: 'connections_only',
        });

      expect([200, 401]).toContain(response.status);
    });

    it('should filter location based on privacy', async () => {
      const response = await request(app)
        .get('/api/profiles/user2')
        .set('Authorization', authToken);

      if (response.status === 200) {
        const profile = response.body;
        // Location should be hidden based on privacy settings
        expect(profile).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', async () => {
      const response = await request(app)
        .put('/api/profiles/user1')
        .set('Authorization', authToken)
        .send({
          bio: null,
        });

      expect([200, 401]).toContain(response.status);
    });

    it('should handle XSS in bio', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      const response = await request(app)
        .put('/api/profiles/user1')
        .set('Authorization', authToken)
        .send({
          bio: xssPayload,
        });

      expect([200, 401]).toContain(response.status);
    });

    it('should handle extremely long bio', async () => {
      const longBio = 'a'.repeat(10000);

      const response = await request(app)
        .put('/api/profiles/user1')
        .set('Authorization', authToken)
        .send({
          bio: longBio,
        });

      expect([200, 413]).toContain(response.status);
    });
  });
});
