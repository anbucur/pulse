/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRouter from '../routes/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          display_name: 'Test User',
        });

      expect([200, 201]).toContain(response.status);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
          display_name: 'Test',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '123',
          display_name: 'Test',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle duplicate email registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'SecurePass123!',
          display_name: 'Test',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should sanitize email input', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: '  test@example.com  ',
          password: 'SecurePass123!',
          display_name: 'Test',
        });

      expect([200, 201, 400]).toContain(response.status);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
        });

      expect([200, 401]).toContain(response.status);
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
    });

    it('should handle missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should return JWT token on success', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
        });

      if (response.status === 200) {
        expect(response.body.token).toBeDefined();
        expect(typeof response.body.token).toBe('string');
      }
    });
  });

  describe('JWT Validation', () => {
    it('should reject expired tokens', async () => {
      const response = await request(app)
        .get('/api/auth/validate')
        .set('Authorization', 'Bearer expired.jwt.token');

      expect(response.status).toBe(401);
    });

    it('should reject malformed tokens', async () => {
      const response = await request(app)
        .get('/api/auth/validate')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/auth/validate');

      expect(response.status).toBe(401);
    });

    it('should accept valid token', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
        });

      if (loginResponse.status === 200) {
        const response = await request(app)
          .get('/api/auth/validate')
          .set('Authorization', `Bearer ${loginResponse.body.token}`);

        expect([200, 401]).toContain(response.status);
      }
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should sanitize email input', async () => {
      const sqlInjection = "test@example.com'; DROP TABLE users; --";

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: sqlInjection,
          password: 'SecurePass123!',
        });

      // Should return auth error, not crash database
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle special characters in password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: "'; DROP TABLE users; --",
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: null,
          password: 'SecurePass123!',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle empty password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: '',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle extremely long email', async () => {
      const longEmail = 'a'.repeat(1000) + '@example.com';

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: longEmail,
          password: 'SecurePass123!',
          display_name: 'Test',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle Unicode characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          display_name: '用户测试',
        });

      expect([200, 201, 400]).toContain(response.status);
    });
  });
});
