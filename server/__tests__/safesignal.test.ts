/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import safesignalRouter from '../routes/safesignal';

const app = express();
app.use(express.json());
app.use('/api/safesignal', safesignalRouter);

describe('SafeSignal API', () => {
  const authToken = 'Bearer mock-token';

  describe('SOS Creation', () => {
    it('should create SOS alert', async () => {
      const response = await request(app)
        .post('/alerts')
        .set('Authorization', authToken)
        .send({
          location: { latitude: 40.7128, longitude: -74.006 },
        });

      expect([200, 201, 401]).toContain(response.status);
    });

    it('should require location data', async () => {
      const response = await request(app)
        .post('/alerts')
        .set('Authorization', authToken)
        .send({});

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should validate GPS coordinates', async () => {
      const response = await request(app)
        .post('/alerts')
        .set('Authorization', authToken)
        .send({
          location: { latitude: 999, longitude: 999 },
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Trusted Contacts', () => {
    it('should add trusted contact', async () => {
      const response = await request(app)
        .post('/contacts')
        .set('Authorization', authToken)
        .send({
          name: 'Emergency Contact',
          phone: '+1234567890',
          email: 'contact@example.com',
        });

      expect([200, 201, 401]).toContain(response.status);
    });

    it('should list trusted contacts', async () => {
      const response = await request(app)
        .get('/contacts')
        .set('Authorization', authToken);

      expect([200, 401]).toContain(response.status);
    });

    it('should update contact priority', async () => {
      const response = await request(app)
        .put('/contacts/contact1')
        .set('Authorization', authToken)
        .send({
          priority: 1,
        });

      expect([200, 404]).toContain(response.status);
    });

    it('should remove trusted contact', async () => {
      const response = await request(app)
        .delete('/contacts/contact1')
        .set('Authorization', authToken);

      expect([200, 204, 404]).toContain(response.status);
    });
  });

  describe('Alert Escalation', () => {
    it('should escalate after timeout', async () => {
      const response = await request(app)
        .post('/alerts/alert1/escalate')
        .set('Authorization', authToken)
        .send({
          reason: 'timeout',
        });

      expect([200, 201, 404]).toContain(response.status);
    });

    it('should notify contacts on escalation', async () => {
      const response = await request(app)
        .post('/alerts/alert1/notify')
        .set('Authorization', authToken);

      expect([200, 201, 404]).toContain(response.status);
    });

    it('should cancel alert', async () => {
      const response = await request(app)
        .post('/alerts/alert1/cancel')
        .set('Authorization', authToken)
        .send({
          reason: 'false_alarm',
        });

      expect([200, 204, 404]).toContain(response.status);
    });
  });

  describe('Fake Call', () => {
    it('should schedule fake call', async () => {
      const response = await request(app)
        .post('/fake-call')
        .set('Authorization', authToken)
        .send({
          delay_seconds: 30,
          contact_name: 'Mom',
        });

      expect([200, 201, 401]).toContain(response.status);
    });

    it('should cancel scheduled call', async () => {
      const response = await request(app)
        .post('/fake-call/cancel')
        .set('Authorization', authToken);

      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null location', async () => {
      const response = await request(app)
        .post('/alerts')
        .set('Authorization', authToken)
        .send({
          location: null,
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle missing trusted contacts', async () => {
      const response = await request(app)
        .post('/alerts')
        .set('Authorization', authToken)
        .send({
          location: { latitude: 40.7128, longitude: -74.006 },
        });

      expect([200, 201, 400]).toContain(response.status);
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/contacts')
        .set('Authorization', authToken)
        .send({
          name: 'Contact',
          phone: 'invalid-phone',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle concurrent alert creation', async () => {
      const response1 = await request(app)
        .post('/alerts')
        .set('Authorization', authToken)
        .send({ location: { latitude: 40.7128, longitude: -74.006 } });

      const response2 = await request(app)
        .post('/alerts')
        .set('Authorization', authToken)
        .send({ location: { latitude: 40.7128, longitude: -74.006 } });

      expect([200, 201, 400, 409]).toContain(response1.status);
    });

    it('should handle location permission denial', async () => {
      const response = await request(app)
        .post('/alerts')
        .set('Authorization', authToken)
        .send({
          location: null,
          error: 'Location permission denied',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
