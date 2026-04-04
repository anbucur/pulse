/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { pool } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Get all discovered events with filters
router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const {
    type,
    category,
    city,
    lat,
    lng,
    radius = '50',
    start_date,
    end_date,
    page = '1',
    limit = '20',
    search
  } = req.query;

  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  const userId = req.userId;

  let query = `
    SELECT
      de.*,
      COALESCE(er.rsvp_status, 'none') as user_rsvp,
      COALESCE(er.visibility, 'public') as rsvp_visibility,
      COUNT(DISTINCT er2.user_id) FILTER (WHERE er2.rsvp_status = 'going') as attending_count,
      COALESCE(json_agg(
        DISTINCT jsonb_build_object(
          'user_id', p.user_id,
          'display_name', p.display_name,
          'age', p.age,
          'gender', p.gender,
          'primary_photo', p.photos->(p.primary_photo_index || 0)
        ) FILTER (WHERE er2.user_id IS NOT NULL AND er2.visibility = 'public')
      ), '[]') as attendees
    FROM discovered_events de
    LEFT JOIN event_rsvps er ON er.event_id = de.id AND er.user_id = $1
    LEFT JOIN event_rsvps er2 ON er2.event_id = de.id AND er2.rsvp_status = 'going'
    LEFT JOIN profiles p ON p.user_id = er2.user_id
    WHERE de.event_date > NOW() - INTERVAL '1 hour'
  `;

  const params: any[] = [userId];
  let paramCount = 1;

  if (type) {
    paramCount++;
    query += ` AND de.event_type = $${paramCount}`;
    params.push(type);
  }

  if (category) {
    paramCount++;
    query += ` AND de.category = $${paramCount}`;
    params.push(category);
  }

  if (city) {
    paramCount++;
    query += ` AND de.city ILIKE $${paramCount}`;
    params.push(`%${city}%`);
  }

  if (search) {
    paramCount++;
    query += ` AND (de.title ILIKE $${paramCount} OR de.description ILIKE $${paramCount})`;
    params.push(`%${search}%`);
  }

  // Geospatial filtering
  if (lat && lng) {
    paramCount++;
    query += ` AND de.latitude IS NOT NULL AND de.longitude IS NOT NULL`;
    paramCount++;
    // Using simple distance calculation (in production, use PostGIS)
    query += ` AND (6371 * acos(cos(radians($${paramCount - 1})) * cos(radians(de.latitude)) * cos(radians(de.longitude) - radians($${paramCount})) + sin(radians($${paramCount - 1})) * sin(radians(de.latitude)))) < $${paramCount + 1}`;
    params.push(parseFloat(lat as string));
    params.push(parseFloat(lng as string));
    params.push(parseFloat(radius as string));
  }

  if (start_date) {
    paramCount++;
    query += ` AND de.event_date >= $${paramCount}`;
    params.push(start_date);
  }

  if (end_date) {
    paramCount++;
    query += ` AND de.event_date <= $${paramCount}`;
    params.push(end_date);
  }

  query += `
    GROUP BY de.id, er.rsvp_status, er.visibility
    ORDER BY de.event_date ASC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `;
  params.push(parseInt(limit as string), offset);

  const result = await pool.query(query, params);

  // Get count for pagination
  let countQuery = 'SELECT COUNT(DISTINCT de.id) as total FROM discovered_events de WHERE de.event_date > NOW() - INTERVAL \'1 hour\'';
  const countParams: any[] = [];
  let countParamCount = 0;

  if (type) {
    countParamCount++;
    countQuery += ` AND de.event_type = $${countParamCount}`;
    countParams.push(type);
  }
  if (category) {
    countParamCount++;
    countQuery += ` AND de.category = $${countParamCount}`;
    countParams.push(category);
  }
  if (city) {
    countParamCount++;
    countQuery += ` AND de.city ILIKE $${countParamCount}`;
    countParams.push(`%${city}%`);
  }
  if (search) {
    countParamCount++;
    countQuery += ` AND (de.title ILIKE $${countParamCount} OR de.description ILIKE $${countParamCount})`;
    countParams.push(`%${search}%`);
  }
  if (start_date) {
    countParamCount++;
    countQuery += ` AND de.event_date >= $${countParamCount}`;
    countParams.push(start_date);
  }
  if (end_date) {
    countParamCount++;
    countQuery += ` AND de.event_date <= $${countParamCount}`;
    countParams.push(end_date);
  }

  const countResult = await pool.query(countQuery, countParams);

  res.json({
    events: result.rows,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total: parseInt(countResult.rows[0].total),
      totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit as string))
    }
  });
}));

// Get nearby events
router.get('/nearby', asyncHandler(async (req: AuthRequest, res) => {
  const { lat, lng, radius = '25', limit = '10' } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const result = await pool.query(`
    SELECT
      de.*,
      (6371 * acos(
        cos(radians($1)) * cos(radians(de.latitude)) *
        cos(radians(de.longitude) - radians($2)) +
        sin(radians($1)) * sin(radians(de.latitude))
      )) as distance_km,
      COALESCE(er.rsvp_status, 'none') as user_rsvp,
      COUNT(DISTINCT er2.user_id) FILTER (WHERE er2.rsvp_status = 'going') as attending_count
    FROM discovered_events de
    LEFT JOIN event_rsvps er ON er.event_id = de.id AND er.user_id = $3
    LEFT JOIN event_rsvps er2 ON er2.event_id = de.id AND er2.rsvp_status = 'going'
    WHERE de.latitude IS NOT NULL
      AND de.longitude IS NOT NULL
      AND de.event_date > NOW() - INTERVAL '1 hour'
    HAVING (6371 * acos(
      cos(radians($1)) * cos(radians(de.latitude)) *
      cos(radians(de.longitude) - radians($2)) +
      sin(radians($1)) * sin(radians(de.latitude))
    )) < $4
    GROUP BY de.id, er.rsvp_status
    ORDER BY distance_km ASC, de.event_date ASC
    LIMIT $5
  `, [parseFloat(lat as string), parseFloat(lng as string), req.userId, parseFloat(radius as string), parseInt(limit as string)]);

  res.json(result.rows);
}));

// Get event categories
router.get('/categories', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT * FROM event_categories
    WHERE active = true
    ORDER BY display_order ASC
  `);

  res.json(result.rows);
}));

// RSVP to an event
router.post('/:eventId/rsvp', asyncHandler(async (req: AuthRequest, res) => {
  const { eventId } = req.params;
  const { rsvp_status = 'going', plus_ones = 0, notes, visibility = 'public' } = req.body;

  // Check event exists
  const eventResult = await pool.query(
    'SELECT * FROM discovered_events WHERE id = $1',
    [eventId]
  );

  if (eventResult.rows.length === 0) {
    throw new AppError('Event not found', 404);
  }

  const result = await pool.query(`
    INSERT INTO event_rsvps (user_id, event_id, rsvp_status, plus_ones, notes, visibility)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id, event_id)
    DO UPDATE SET
      rsvp_status = EXCLUDED.rsvp_status,
      plus_ones = EXCLUDED.plus_ones,
      notes = EXCLUDED.notes,
      visibility = EXCLUDED.visibility,
      updated_at = NOW()
    RETURNING *
  `, [req.userId, eventId, rsvp_status, plus_ones, notes, visibility]);

  res.json(result.rows[0]);
}));

// Cancel RSVP
router.delete('/:eventId/rsvp', asyncHandler(async (req: AuthRequest, res) => {
  const { eventId } = req.params;

  await pool.query(
    'DELETE FROM event_rsvps WHERE user_id = $1 AND event_id = $2',
    [req.userId, eventId]
  );

  res.json({ success: true });
}));

// Get event details with attendees
router.get('/:eventId', asyncHandler(async (req: AuthRequest, res) => {
  const { eventId } = req.params;

  const eventResult = await pool.query(`
    SELECT
      de.*,
      COALESCE(er.rsvp_status, 'none') as user_rsvp,
      COALESCE(er.visibility, 'public') as rsvp_visibility,
      COUNT(DISTINCT er2.user_id) FILTER (WHERE er2.rsvp_status = 'going') as attending_count
    FROM discovered_events de
    LEFT JOIN event_rsvps er ON er.event_id = de.id AND er.user_id = $1
    LEFT JOIN event_rsvps er2 ON er2.event_id = de.id AND er2.rsvp_status = 'going'
    WHERE de.id = $2
    GROUP BY de.id, er.rsvp_status, er.visibility
  `, [req.userId, eventId]);

  if (eventResult.rows.length === 0) {
    throw new AppError('Event not found', 404);
  }

  const event = eventResult.rows[0];

  // Get attendees (only those with public visibility)
  const attendeesResult = await pool.query(`
    SELECT
      p.user_id,
      p.display_name,
      p.age,
      p.gender,
      p.photos,
      p.primary_photo_index,
      p.interests,
      er.plus_ones,
      er.notes,
      er.rsvp_status
    FROM event_rsvps er
    JOIN profiles p ON p.user_id = er.user_id
    WHERE er.event_id = $1
      AND er.rsvp_status = 'going'
      AND er.visibility = 'public'
      AND er.user_id != $2
    ORDER BY er.created_at ASC
    LIMIT 50
  `, [eventId, req.userId]);

  event.attendees = attendeesResult.rows;

  res.json(event);
}));

// Check in to event
router.post('/:eventId/checkin', asyncHandler(async (req: AuthRequest, res) => {
  const { eventId } = req.params;
  const { latitude, longitude } = req.body;

  // Get event details
  const eventResult = await pool.query(
    'SELECT * FROM discovered_events WHERE id = $1',
    [eventId]
  );

  if (eventResult.rows.length === 0) {
    throw new AppError('Event not found', 404);
  }

  const event = eventResult.rows[0];

  // Verify location if coordinates provided
  if (latitude && longitude && event.latitude && event.longitude) {
    const distance = calculateDistance(
      parseFloat(latitude),
      parseFloat(longitude),
      event.latitude,
      event.longitude
    );

    if (distance > 0.5) { // 500m threshold
      throw new AppError('You must be at the event location to check in', 400);
    }
  }

  // Update RSVP check-in status
  await pool.query(`
    UPDATE event_rsvps
    SET check_in_status = 'checked_in',
        checked_in_at = NOW()
    WHERE user_id = $1 AND event_id = $2
  `, [req.userId, eventId]);

  // Create attendance record
  await pool.query(`
    INSERT INTO event_attendance (user_id, event_id, rsvp_id)
    VALUES ($1, $2, (
      SELECT id FROM event_rsvps WHERE user_id = $1 AND event_id = $2
    ))
    ON CONFLICT (user_id, event_id)
    DO UPDATE SET checked_in_at = NOW()
  `, [req.userId, eventId]);

  res.json({ success: true, checked_in_at: new Date().toISOString() });
}));

// Check out from event
router.post('/:eventId/checkout', asyncHandler(async (req: AuthRequest, res) => {
  const { eventId } = req.params;

  // Update RSVP check-out status
  await pool.query(`
    UPDATE event_rsvps
    SET check_in_status = 'checked_out',
        checked_out_at = NOW()
    WHERE user_id = $1 AND event_id = $2
  `, [req.userId, eventId]);

  // Update attendance record
  const result = await pool.query(`
    UPDATE event_attendance
    SET checked_out_at = NOW(),
        duration_minutes = EXTRACT(EPOCH FROM (NOW() - checked_in_at)) / 60
    WHERE user_id = $1 AND event_id = $2
    RETURNING duration_minutes
  `, [req.userId, eventId]);

  res.json({
    success: true,
    checked_out_at: new Date().toISOString(),
    duration_minutes: result.rows[0]?.duration_minutes
  });
}));

// Get user's event interests
router.get('/interests/me', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(`
    SELECT ei.*, ec.name as category_name, ec.color, ec.icon
    FROM event_interests ei
    LEFT JOIN event_categories ec ON ec.slug = ei.category
    WHERE ei.user_id = $1
    ORDER BY ei.preference_score DESC
  `, [req.userId]);

  res.json(result.rows);
}));

// Update event interests
router.post('/interests', asyncHandler(async (req: AuthRequest, res) => {
  const { interests } = req.body; // Array of { category, preference_score }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const interest of interests) {
      await client.query(`
        INSERT INTO event_interests (user_id, category, preference_score)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, category)
        DO UPDATE SET
          preference_score = EXCLUDED.preference_score,
          updated_at = NOW()
      `, [req.userId, interest.category, interest.preference_score || 5]);
    }

    await client.query('COMMIT');

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Get personalized event recommendations
router.get('/recommendations', asyncHandler(async (req: AuthRequest, res) => {
  const { limit = '10' } = req.query;

  const result = await pool.query(`
    SELECT
      de.*,
      COALESCE(er.rsvp_status, 'none') as user_rsvp,
      COALESCE(ei.preference_score, 5) as preference_score,
      COUNT(DISTINCT er2.user_id) FILTER (WHERE er2.rsvp_status = 'going') as attending_count
    FROM discovered_events de
    LEFT JOIN event_rsvps er ON er.event_id = de.id AND er.user_id = $1
    LEFT JOIN event_interests ei ON ei.category = de.category AND ei.user_id = $1
    LEFT JOIN event_rsvps er2 ON er2.event_id = de.id AND er2.rsvp_status = 'going'
    WHERE de.event_date > NOW() - INTERVAL '1 hour'
      AND de.event_date < NOW() + INTERVAL '30 days'
    GROUP BY de.id, er.rsvp_status, ei.preference_score
    ORDER BY
      COALESCE(ei.preference_score, 0) DESC,
      de.event_date ASC
    LIMIT $2
  `, [req.userId, parseInt(limit as string)]);

  res.json(result.rows);
}));

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default router;
