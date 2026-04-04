/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { pool } from '../config/index.js';

const router = express.Router();

// GET /api/events - List all public events with optional filters
router.get('/', async (req, res) => {
  try {
    const { type, lat, lng, radius = 50, upcoming_only = true } = req.query;

    let query = `
      SELECT e.*,
        (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = e.id) as attendee_count,
        p.display_name as creator_name,
        p.primary_photo_index,
        p.photos
      FROM events e
      LEFT JOIN profiles p ON p.user_id = e.created_by
      WHERE e.is_public = true AND e.is_cancelled = false
    `;
    const params: any[] = [];

    if (upcoming_only === 'true') {
      query += ' AND e.event_date >= CURRENT_TIMESTAMP';
    }

    if (type) {
      params.push(type);
      query += ` AND e.event_type = $${params.length}`;
    }

    if (lat && lng) {
      params.push(parseFloat(lat as string));
      params.push(parseFloat(lng as string));
      params.push(parseFloat(radius as string));
      query += ` AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL
        AND ST_DWithin(
          ST_MakePoint(e.longitude, e.latitude)::geography,
          ST_MakePoint($${params.length - 2}, $${params.length - 1})::geography,
          $${params.length} * 1000
        )`;
    }

    query += ' ORDER BY e.event_date ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/:id - Get event details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');
    let userId = null;

    if (token) {
      const userResult = await pool.query(
        'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
        [token]
      );
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }
    }

    const eventResult = await pool.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = e.id) as attendee_count,
        p.display_name as creator_name,
        p.photos as creator_photos,
        p.primary_photo_index as creator_photo_index
      FROM events e
      LEFT JOIN profiles p ON p.user_id = e.created_by
      WHERE e.id = $1`,
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // Get attendees
    const attendeesResult = await pool.query(
      `SELECT ea.*, p.display_name, p.age, p.gender, p.photos, p.primary_photo_index, p.interests
      FROM event_attendees ea
      JOIN profiles p ON p.user_id = ea.user_id
      WHERE ea.event_id = $1
      ORDER BY ea.joined_at ASC`,
      [id]
    );

    // Check if current user is attending
    let userAttendance = null;
    if (userId) {
      const attendanceResult = await pool.query(
        'SELECT * FROM event_attendees WHERE event_id = $1 AND user_id = $2',
        [id, userId]
      );
      if (attendanceResult.rows.length > 0) {
        userAttendance = attendanceResult.rows[0];
      }
    }

    res.json({
      ...event,
      attendees: attendeesResult.rows,
      user_attendance: userAttendance,
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// POST /api/events - Create a new event
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = userResult.rows[0].id;
    const {
      title,
      description,
      event_type,
      event_url,
      venue_name,
      venue_address,
      latitude,
      longitude,
      event_date,
      end_date,
      age_restriction,
      dress_code,
      ticket_price,
      ticket_url,
      tags,
      is_public = true,
      max_attendees,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO events (
        created_by, title, description, event_type, event_url,
        venue_name, venue_address, latitude, longitude,
        event_date, end_date, age_restriction, dress_code,
        ticket_price, ticket_url, tags, is_public, max_attendees
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        userId,
        title,
        description,
        event_type,
        event_url,
        venue_name,
        venue_address,
        latitude,
        longitude,
        event_date,
        end_date,
        age_restriction,
        dress_code,
        ticket_price,
        ticket_url,
        tags,
        is_public,
        max_attendees,
      ]
    );

    // Auto-join the creator
    await pool.query(
      'INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)',
      [result.rows[0].id, userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /api/events/:id - Update an event
router.put('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = userResult.rows[0].id;
    const { id } = req.params;

    // Check if user is the creator
    const eventCheck = await pool.query(
      'SELECT created_by FROM events WHERE id = $1',
      [id]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (eventCheck.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const {
      title,
      description,
      event_type,
      event_url,
      venue_name,
      venue_address,
      latitude,
      longitude,
      event_date,
      end_date,
      age_restriction,
      dress_code,
      ticket_price,
      ticket_url,
      tags,
      is_public,
      max_attendees,
      status,
      is_cancelled,
    } = req.body;

    const result = await pool.query(
      `UPDATE events SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        event_type = COALESCE($4, event_type),
        event_url = COALESCE($5, event_url),
        venue_name = COALESCE($6, venue_name),
        venue_address = COALESCE($7, venue_address),
        latitude = COALESCE($8, latitude),
        longitude = COALESCE($9, longitude),
        event_date = COALESCE($10, event_date),
        end_date = COALESCE($11, end_date),
        age_restriction = COALESCE($12, age_restriction),
        dress_code = COALESCE($13, dress_code),
        ticket_price = COALESCE($14, ticket_price),
        ticket_url = COALESCE($15, ticket_url),
        tags = COALESCE($16, tags),
        is_public = COALESCE($17, is_public),
        max_attendees = COALESCE($18, max_attendees),
        status = COALESCE($19, status),
        is_cancelled = COALESCE($20, is_cancelled)
      WHERE id = $1
      RETURNING *`,
      [
        id,
        title,
        description,
        event_type,
        event_url,
        venue_name,
        venue_address,
        latitude,
        longitude,
        event_date,
        end_date,
        age_restriction,
        dress_code,
        ticket_price,
        ticket_url,
        tags,
        is_public,
        max_attendees,
        status,
        is_cancelled,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/events/:id - Delete an event
router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = userResult.rows[0].id;
    const { id } = req.params;

    // Check if user is the creator
    const eventCheck = await pool.query(
      'SELECT created_by FROM events WHERE id = $1',
      [id]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (eventCheck.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.query('DELETE FROM events WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// POST /api/events/:id/join - Join an event
router.post('/:id/join', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = userResult.rows[0].id;
    const { id } = req.params;
    const { plus_ones = 0, notes } = req.body;

    // Check if event exists and has space
    const eventCheck = await pool.query(
      'SELECT max_attendees, (SELECT COUNT(*) FROM event_attendees WHERE event_id = $1) as current_attendees FROM events WHERE id = $1',
      [id]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const { max_attendees, current_attendees } = eventCheck.rows[0];
    if (max_attendees && current_attendees >= max_attendees) {
      return res.status(400).json({ error: 'Event is full' });
    }

    // Check if already attending
    const existingCheck = await pool.query(
      'SELECT id FROM event_attendees WHERE event_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Already attending this event' });
    }

    const result = await pool.query(
      'INSERT INTO event_attendees (event_id, user_id, plus_ones, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, userId, plus_ones, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error joining event:', error);
    res.status(500).json({ error: 'Failed to join event' });
  }
});

// POST /api/events/:id/leave - Leave an event
router.post('/:id/leave', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = userResult.rows[0].id;
    const { id } = req.params;

    await pool.query(
      'DELETE FROM event_attendees WHERE event_id = $1 AND user_id = $2',
      [id, userId]
    );

    res.status(204).send();
  } catch (error) {
    console.error('Error leaving event:', error);
    res.status(500).json({ error: 'Failed to leave event' });
  }
});

// GET /api/events/:id/matches - Get matches for an event (attendees with compatibility)
router.get('/:id/matches', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = userResult.rows[0].id;
    const { id } = req.params;

    // Check if user is attending
    const attendanceCheck = await pool.query(
      'SELECT id FROM event_attendees WHERE event_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (attendanceCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You must join this event to see matches' });
    }

    // Get other attendees with their profiles
    const matchesResult = await pool.query(
      `SELECT DISTINCT
        p.user_id,
        p.display_name,
        p.age,
        p.gender,
        p.photos,
        p.primary_photo_index,
        p.interests,
        p.bio,
        p.location,
        ea.plus_ones,
        ea.notes,
        CASE
          WHEN p.interests && (
            SELECT ARRAY_AGG(DISTINCT unnest(interests))
            FROM profiles WHERE user_id = $2
          ) THEN true
          ELSE false
        END as has_shared_interests
      FROM event_attendees ea
      JOIN profiles p ON p.user_id = ea.user_id
      WHERE ea.event_id = $1 AND ea.user_id != $2
      ORDER BY ea.joined_at ASC`,
      [id, userId]
    );

    // Calculate shared interests for each match
    const matches = await Promise.all(
      matchesResult.rows.map(async (match) => {
        const sharedInterestsResult = await pool.query(
          `SELECT unnest(interests) as interest
          FROM profiles
          WHERE user_id = ANY(ARRAY[$1, $2])
          AND interests && (
            SELECT interests FROM profiles WHERE user_id = $1
          )
          GROUP BY interest
          HAVING COUNT(*) > 1`,
          [userId, match.user_id]
        );

        return {
          ...match,
          shared_interests: sharedInterestsResult.rows.map((r) => r.interest),
        };
      })
    );

    res.json(matches);
  } catch (error) {
    console.error('Error fetching event matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// GET /api/events/my-events - Get user's events
router.get('/my/events', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = userResult.rows[0].id;

    const result = await pool.query(
      `SELECT e.*,
        ea.attendance_status,
        ea.plus_ones,
        ea.notes,
        (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id) as attendee_count
      FROM events e
      JOIN event_attendees ea ON ea.event_id = e.id
      WHERE ea.user_id = $1
      ORDER BY e.event_date ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

export default router;
