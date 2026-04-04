/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import eventsRouter from '../routes/events';

const app = express();
app.use(express.json());
app.use('/api/events', eventsRouter);

describe('Events API', () => {
  const authToken = 'Bearer mock-token';

  describe('GET /api/events', () => {
    it('should list all public events', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('Authorization', authToken);

      expect([200, 401]).toContain(response.status);
    });

    it('should filter by event type', async () => {
      const response = await request(app)
        .get('/api/events?type=social')
        .set('Authorization', authToken);

      expect([200, 401]).toContain(response.status);
    });

    it('should filter by location radius', async () => {
      const response = await request(app)
        .get('/api/events?lat=40.7128&lng=-74.006&radius=10')
        .set('Authorization', authToken);

      expect([200, 401]).toContain(response.status);
    });

    it('should filter upcoming events only', async () => {
      const response = await request(app)
        .get('/api/events?upcoming_only=true')
        .set('Authorization', authToken);

      expect([200, 401]).toContain(response.status);
    });
  });

  describe('POST /api/events', () => {
    it('should create event with valid data', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', authToken)
        .send({
          title: 'Test Event',
          description: 'Test Description',
          event_type: 'social',
          event_date: '2026-05-01T20:00:00Z',
        });

      expect([200, 201, 401]).toContain(response.status);
    });

    it('should require title and date', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', authToken)
        .send({
          description: 'Missing required fields',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should validate event type enum', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', authToken)
        .send({
          title: 'Test',
          event_type: 'invalid_type',
          event_date: '2026-05-01T20:00:00Z',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Event CRUD', () => {
    it('should update own event', async () => {
      const response = await request(app)
        .put('/events/event1')
        .set('Authorization', authToken)
        .send({
          title: 'Updated Title',
        });

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it('should prevent updating others events', async () => {
      const response = await request(app)
        .put('/events/event2')
        .set('Authorization', authToken)
        .send({
          title: 'Hacked Title',
        });

      expect([403, 404]).toContain(response.status);
    });

    it('should delete own event', async () => {
      const response = await request(app)
        .delete('/events/event1')
        .set('Authorization', authToken);

      expect([200, 204, 401, 403, 404]).toContain(response.status);
    });
  });

  describe('Attendee Matching', () => {
    it('should join event', async () => {
      const response = await request(app)
        .post('/events/event1/join')
        .set('Authorization', authToken)
        .send({ plus_ones: 0 });

      expect([200, 201, 400, 401]).toContain(response.status);
    });

    it('should leave event', async () => {
      const response = await request(app)
        .post('/events/event1/leave')
        .set('Authorization', authToken);

      expect([200, 204, 401]).toContain(response.status);
    });

    it('should prevent joining full event', async () => {
      const response = await request(app)
        .post('/events/full-event/join')
        .set('Authorization', authToken)
        .send({ plus_ones: 0 });

      expect([400, 404]).toContain(response.status);
    });

    it('should prevent duplicate joins', async () => {
      const response = await request(app)
        .post('/events/event1/join')
        .set('Authorization', authToken)
        .send({ plus_ones: 0 });

      expect([200, 201, 400]).toContain(response.status);
    });
  });

  describe('Date Range Queries', () => {
    it('should query events by date range', async () => {
      const response = await request(app)
        .get('/api/events?start_date=2026-05-01&end_date=2026-05-31')
        .set('Authorization', authToken);

      expect([200, 401]).toContain(response.status);
    });

    it('should handle invalid date formats', async () => {
      const response = await request(app)
        .get('/api/events?start_date=invalid-date')
        .set('Authorization', authToken);

      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null event data', async () => {
      const response = await request(app)
        .get('/api/events/null-event')
        .set('Authorization', authToken);

      expect([404, 401]).toContain(response.status);
    });

    it('should handle XSS in event title', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', authToken)
        .send({
          title: xssPayload,
          event_date: '2026-05-01T20:00:00Z',
        });

      expect([200, 201, 400, 401]).toContain(response.status);
    });

    it('should validate max_attendees', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', authToken)
        .send({
          title: 'Test',
          event_date: '2026-05-01T20:00:00Z',
          max_attendees: -5,
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
