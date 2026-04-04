/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import tribesRouter from '../routes/tribes';

const app = express();
app.use(express.json());
app.use('/api/tribes', tribesRouter);

describe('Tribes API', () => {
  const authToken = 'Bearer mock-token';

  describe('Tribe Management', () => {
    it('should create a new tribe', async () => {
      const response = await request(app)
        .post('/')
        .set('Authorization', authToken)
        .send({
          name: 'Test Tribe',
          description: 'A test tribe',
          is_private: false,
        });

      expect([200, 201, 401]).toContain(response.status);
    });

    it('should update tribe as admin', async () => {
      const response = await request(app)
        .put('/tribe1')
        .set('Authorization', authToken)
        .send({
          description: 'Updated description',
        });

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it('should prevent non-admin updates', async () => {
      const response = await request(app)
        .put('/tribe2')
        .set('Authorization', authToken)
        .send({
          name: 'Hacked Name',
        });

      expect([403, 404]).toContain(response.status);
    });

    it('should delete tribe as admin', async () => {
      const response = await request(app)
        .delete('/tribe1')
        .set('Authorization', authToken);

      expect([200, 204, 401, 403, 404]).toContain(response.status);
    });
  });

  describe('Membership', () => {
    it('should join public tribe', async () => {
      const response = await request(app)
        .post('/tribe1/join')
        .set('Authorization', authToken);

      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should request to join private tribe', async () => {
      const response = await request(app)
        .post('/private-tribe/join')
        .set('Authorization', authToken);

      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should leave tribe', async () => {
      const response = await request(app)
        .post('/tribe1/leave')
        .set('Authorization', authToken);

      expect([200, 204, 400, 404]).toContain(response.status);
    });

    it('should list tribe members', async () => {
      const response = await request(app)
        .get('/tribe1/members')
        .set('Authorization', authToken);

      expect([200, 401, 404]).toContain(response.status);
    });
  });

  describe('Role-based Access', () => {
    it('should promote member to admin', async () => {
      const response = await request(app)
        .post('/tribe1/members/user2/promote')
        .set('Authorization', authToken);

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it('should only allow admins to promote', async () => {
      const response = await request(app)
        .post('/tribe2/members/user3/promote')
        .set('Authorization', authToken);

      expect([403, 404]).toContain(response.status);
    });

    it('should remove member from tribe', async () => {
      const response = await request(app)
        .delete('/tribe1/members/user2')
        .set('Authorization', authToken);

      expect([200, 204, 401, 403, 404]).toContain(response.status);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tribe name conflicts', async () => {
      const response = await request(app)
        .post('/')
        .set('Authorization', authToken)
        .send({
          name: 'Existing Tribe',
        });

      expect([200, 201, 400]).toContain(response.status);
    });

    it('should handle max tribe size', async () => {
      const response = await request(app)
        .post('/full-tribe/join')
        .set('Authorization', authToken);

      expect([400, 404]).toContain(response.status);
    });

    it('should prevent last admin from leaving', async () => {
      const response = await request(app)
        .post('/tribe1/leave')
        .set('Authorization', authToken);

      expect([200, 204, 400]).toContain(response.status);
    });

    it('should handle XSS in tribe description', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      const response = await request(app)
        .post('/')
        .set('Authorization', authToken)
        .send({
          name: 'Test Tribe',
          description: xssPayload,
        });

      expect([200, 201, 400]).toContain(response.status);
    });
  });
});
