/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { pool } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();
router.use(authenticate);

// Get upcoming speed dating events
router.get('/events', asyncHandler(async (req: AuthRequest, res) => {
  const { status = 'scheduled', page = '1', limit = '20' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  const result = await pool.query(`
    SELECT
      sde.*,
      COALESCE(sdp.id IS NOT NULL, false) as user_registered,
      COALESCE(sdp.status, 'none') as user_status,
      sde.current_participants,
      (SELECT COUNT(*) FROM speed_dating_participants WHERE event_id = sde.id AND status != 'no_show') as actual_participants
    FROM speed_dating_events sde
    LEFT JOIN speed_dating_participants sdp ON sdp.event_id = sde.id AND sdp.user_id = $1
    WHERE sde.status = $2
      AND sde.event_date > NOW() - INTERVAL '2 hours'
    ORDER BY sde.event_date ASC
    LIMIT $3 OFFSET $4
  `, [req.userId, status, parseInt(limit as string), offset]);

  // Get total count
  const countResult = await pool.query(
    'SELECT COUNT(*) as total FROM speed_dating_events WHERE status = $1 AND event_date > NOW() - INTERVAL \'2 hours\'',
    [status]
  );

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

// Get speed dating event details
router.get('/events/:eventId', asyncHandler(async (req: AuthRequest, res) => {
  const { eventId } = req.params;

  const eventResult = await pool.query(`
    SELECT
      sde.*,
      COALESCE(sdp.id IS NOT NULL, false) as user_registered,
      COALESCE(sdp.status, 'none') as user_status,
      sdp.participant_number
    FROM speed_dating_events sde
    LEFT JOIN speed_dating_participants sdp ON sdp.event_id = sde.id AND sdp.user_id = $1
    WHERE sde.id = $2
  `, [req.userId, eventId]);

  if (eventResult.rows.length === 0) {
    throw new AppError('Event not found', 404);
  }

  const event = eventResult.rows[0];

  // Get participants (if registered)
  if (event.user_registered) {
    const participantsResult = await pool.query(`
      SELECT
        sdp.*,
        p.display_name,
        p.age,
        p.gender,
        p.photos,
        p.primary_photo_index,
        p.interests
      FROM speed_dating_participants sdp
      JOIN profiles p ON p.user_id = sdp.user_id
      WHERE sdp.event_id = $1
        AND sdp.status != 'cancelled'
      ORDER BY sdp.participant_number ASC
    `, [eventId]);

    event.participants = participantsResult.rows;
  }

  res.json(event);
}));

// Register for a speed dating event
router.post('/events/:eventId/register', asyncHandler(async (req: AuthRequest, res) => {
  const { eventId } = req.params;

  // Check if user is verified if required
  const eventResult = await pool.query(
    'SELECT * FROM speed_dating_events WHERE id = $1',
    [eventId]
  );

  if (eventResult.rows.length === 0) {
    throw new AppError('Event not found', 404);
  }

  const event = eventResult.rows[0];

  if (event.requires_verification) {
    const verificationResult = await pool.query(
      `SELECT status FROM photo_verifications
       WHERE user_id = $1 AND status = 'verified'
       AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );

    if (verificationResult.rows.length === 0) {
      throw new AppError('Photo verification required for this event', 403);
    }
  }

  // Check if event is full
  if (event.current_participants >= event.max_participants) {
    throw new AppError('Event is full', 400);
  }

  // Check age requirements
  const profileResult = await pool.query(
    'SELECT age, gender FROM profiles WHERE user_id = $1',
    [req.userId]
  );

  if (profileResult.rows.length === 0) {
    throw new AppError('Profile not found', 404);
  }

  const profile = profileResult.rows[0];

  if (profile.age && event.age_min && profile.age < event.age_min) {
    throw new AppError(`You must be at least ${event.age_min} years old to attend`, 400);
  }

  if (profile.age && event.age_max && profile.age > event.age_max) {
    throw new AppError(`You must be ${event.age_max} years old or younger to attend`, 400);
  }

  // Register user
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get participant number
    const participantNumber = event.current_participants + 1;

    const registrationResult = await client.query(`
      INSERT INTO speed_dating_participants (event_id, user_id, participant_number, status)
      VALUES ($1, $2, $3, 'registered')
      ON CONFLICT (event_id, user_id)
      DO UPDATE SET
        status = 'registered',
        participant_number = $3,
        updated_at = NOW()
      RETURNING *
    `, [eventId, req.userId, participantNumber]);

    // Update event participant count
    await client.query(`
      UPDATE speed_dating_events
      SET current_participants = current_participants + 1
      WHERE id = $1
    `, [eventId]);

    // Update user stats
    await client.query(`
      INSERT INTO speed_dating_stats (user_id, events_participated)
      VALUES ($1, 1)
      ON CONFLICT (user_id)
      DO UPDATE SET
        events_participated = speed_dating_stats.events_participated + 1,
        updated_at = NOW()
    `, [req.userId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      registration: registrationResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Check in to speed dating event
router.post('/events/:eventId/checkin', asyncHandler(async (req: AuthRequest, res) => {
  const { eventId } = req.params;

  const result = await pool.query(`
    UPDATE speed_dating_participants
    SET status = 'checked_in',
        checked_in_at = NOW()
    WHERE event_id = $1 AND user_id = $2
    RETURNING *
  `, [eventId, req.userId]);

  if (result.rows.length === 0) {
    throw new AppError('Registration not found', 404);
  }

  res.json({ success: true, participant: result.rows[0] });
}));

// Get current match during event
router.get('/events/:eventId/current-match', asyncHandler(async (req: AuthRequest, res) => {
  const { eventId } = req.params;

  const result = await pool.query(`
    SELECT
      sdm.*,
      p1.display_name as partner_name,
      p1.age as partner_age,
      p1.gender as partner_gender,
      p1.photos as partner_photos,
      p1.primary_photo_index as partner_photo_index,
      sdr.round_number,
      sdr.status as round_status,
      sdr.started_at as round_started_at,
      EXTRACT(EPOCH FROM (NOW() - sdr.started_at)) / 60 as elapsed_minutes
    FROM speed_dating_matches sdm
    JOIN speed_dating_rounds sdr ON sdr.id = sdm.round_id
    JOIN profiles p1 ON p1.user_id = CASE WHEN sdm.participant1_id = $1 THEN sdm.participant2_id ELSE sdm.participant1_id END
    WHERE sdm.event_id = $2
      AND (sdm.participant1_id = $1 OR sdm.participant2_id = $1)
      AND sdm.status IN ('pending', 'active')
      AND sdr.status = 'active'
    ORDER BY sdr.round_number DESC
    LIMIT 1
  `, [req.userId, eventId]);

  if (result.rows.length === 0) {
    return res.json({ match: null });
  }

  res.json({ match: result.rows[0] });
}));

// Submit rating after a match
router.post('/events/:eventId/ratings', asyncHandler(async (req: AuthRequest, res) => {
  const { eventId } = req.params;
  const { match_id, rated_user_id, rating, would_match_again, interest_level, notes, tags } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw new AppError('Rating must be between 1 and 5', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get match details
    const matchResult = await client.query(
      'SELECT * FROM speed_dating_matches WHERE id = $1',
      [match_id]
    );

    if (matchResult.rows.length === 0) {
      throw new AppError('Match not found', 404);
    }

    // Insert rating
    const ratingResult = await client.query(`
      INSERT INTO speed_dating_ratings (match_id, event_id, rater_id, rated_user_id, rating, would_match_again, interest_level, notes, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (rater_id, rated_user_id, match_id)
      DO UPDATE SET
        rating = EXCLUDED.rating,
        would_match_again = EXCLUDED.would_match_again,
        interest_level = EXCLUDED.interest_level,
        notes = EXCLUDED.notes,
        tags = EXCLUDED.tags
      RETURNING *
    `, [match_id, eventId, req.userId, rated_user_id, rating, would_match_again, false, interest_level, notes, tags]);

    // Check for mutual match
    const mutualResult = await client.query(`
      SELECT * FROM speed_dating_ratings
      WHERE match_id = $1
        AND rater_id = $2
        AND rated_user_id = $3
        AND would_match_again = true
    `, [match_id, rated_user_id, req.userId]);

    if (mutualResult.rows.length > 0 && would_match_again) {
      // Create mutual match record
      await client.query(`
        INSERT INTO speed_dating_mutual_matches (event_id, user1_id, user2_id, match_score, compatibility_tags)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (event_id, user1_id, user2_id)
        DO UPDATE SET
          match_score = EXCLUDED.match_score,
          compatibility_tags = EXCLUDED.compatibility_tags
      `, [eventId, Math.min(req.userId, rated_user_id), Math.max(req.userId, rated_user_id), rating, tags || []]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      rating: ratingResult.rows[0],
      isMutualMatch: mutualResult.rows.length > 0 && would_match_again
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Get mutual matches from an event
router.get('/events/:eventId/mutual-matches', asyncHandler(async (req: AuthRequest, res) => {
  const { eventId } = req.params;

  const result = await pool.query(`
    SELECT
      sdmm.*,
      p.display_name,
      p.age,
      p.gender,
      p.photos,
      p.primary_photo_index,
      p.interests,
      p.bio,
      CASE WHEN sdmm.user1_id = $1 THEN sdmm.user2_id ELSE sdmm.user1_id END as matched_user_id
    FROM speed_dating_mutual_matches sdmm
    JOIN profiles p ON p.user_id = CASE WHEN sdmm.user1_id = $1 THEN sdmm.user2_id ELSE sdmm.user1_id END
    WHERE sdmm.event_id = $2
      AND (sdmm.user1_id = $1 OR sdmm.user2_id = $1)
    ORDER BY sdmm.match_score DESC
  `, [req.userId, eventId]);

  res.json(result.rows);
}));

// Get user's speed dating stats
router.get('/stats/me', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(`
    SELECT * FROM speed_dating_stats WHERE user_id = $1
  `, [req.userId]);

  if (result.rows.length === 0) {
    return res.json({
      events_participated: 0,
      total_rounds: 0,
      total_matches: 0,
      mutual_matches: 0,
      average_rating: 0,
      received_rating_count: 0
    });
  }

  res.json(result.rows[0]);
}));

// Cancel registration
router.delete('/events/:eventId/register', asyncHandler(async (req: AuthRequest, res) => {
  const { eventId } = req.params;

  const result = await pool.query(`
    DELETE FROM speed_dating_participants
    WHERE event_id = $1 AND user_id = $2
    RETURNING *
  `, [eventId, req.userId]);

  if (result.rows.length === 0) {
    throw new AppError('Registration not found', 404);
  }

  // Update event participant count
  await pool.query(
    'UPDATE speed_dating_events SET current_participants = current_participants - 1 WHERE id = $1',
    [eventId]
  );

  res.json({ success: true });
}));

// Admin: Create a speed dating event
router.post('/events/create', asyncHandler(async (req: AuthRequest, res) => {
  const {
    title,
    description,
    event_type = 'standard',
    event_date,
    duration_minutes = 90,
    round_duration_minutes = 3,
    break_duration_minutes = 1,
    max_participants = 20,
    min_participants = 6,
    gender_preference = 'any',
    age_min = 18,
    age_max = 100,
    interests_match = false,
    interests_tags = [],
    requires_verification = true,
    entry_fee = 0
  } = req.body;

  if (!title || !event_date) {
    throw new AppError('Title and event date are required', 400);
  }

  // Generate room ID
  const roomId = crypto.randomBytes(16).toString('hex');

  const result = await pool.query(`
    INSERT INTO speed_dating_events (
      title, description, event_type, event_date, duration_minutes,
      round_duration_minutes, break_duration_minutes, max_participants,
      min_participants, gender_preference, age_min, age_max,
      interests_match, interests_tags, requires_verification, entry_fee,
      room_id, host_id, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'scheduled')
    RETURNING *
  `, [
    title, description, event_type, event_date, duration_minutes,
    round_duration_minutes, break_duration_minutes, max_participants,
    min_participants, gender_preference, age_min, age_max,
    interests_match, interests_tags, requires_verification, entry_fee,
    roomId, req.userId
  ]);

  res.json(result.rows[0]);
}));

export default router;
