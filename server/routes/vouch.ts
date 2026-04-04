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

// Get vouches received by a user (public endpoint for viewing profile)
router.get('/received/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { limit = '10', offset = '0' } = req.query;

  const result = await pool.query(
    `SELECT fv.*, vouch_from.display_name as vouch_from_name,
            vouch_from.photos as vouch_from_photos,
            vouch_from.primary_photo_index,
            COALESCE(json_agg(DISTINCT jsonb_build_object(
              'id', vt.id,
              'tag_name', vt.tag_name,
              'tag_category', vt.tag_category,
              'description', vt.description
            ) ORDER BY vt.tag_name) FILTER (WHERE vt.id IS NOT NULL), '[]') as tags,
            COALESCE(json_agg(DISTINCT jsonb_build_object(
              'id', vr.id,
              'reaction_type', vr.reaction_type,
              'user_id', vr.user_id
            ) ORDER BY vr.created_at DESC) FILTER (WHERE vr.id IS NOT NULL), '[]') as reactions
     FROM friend_vouches fv
     LEFT JOIN profiles vouch_from ON vouch_from.user_id = fv.vouch_from_id
     LEFT JOIN vouch_tag_connections vtc ON vtc.vouch_id = fv.id
     LEFT JOIN vouch_tags vt ON vt.id = vtc.tag_id
     LEFT JOIN vouch_reactions vr ON vr.vouch_id = fv.id
     WHERE fv.vouch_for_id = $1
       AND fv.status = 'approved'
       AND fv.anonymous = false
     GROUP BY fv.id, vouch_from.display_name, vouch_from.photos, vouch_from.primary_photo_index
     ORDER BY fv.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  res.json(result.rows);
}));

// Get vouches given by authenticated user
router.get('/given', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT fv.*, vouch_for.display_name as vouch_for_name,
            vouch_for.photos as vouch_for_photos,
            vouch_for.primary_photo_index,
            COALESCE(json_agg(DISTINCT jsonb_build_object(
              'id', vt.id,
              'tag_name', vt.tag_name,
              'tag_category', vt.tag_category
            ) ORDER BY vt.tag_name) FILTER (WHERE vt.id IS NOT NULL), '[]') as tags
     FROM friend_vouches fv
     LEFT JOIN profiles vouch_for ON vouch_for.user_id = fv.vouch_for_id
     LEFT JOIN vouch_tag_connections vtc ON vtc.vouch_id = fv.id
     LEFT JOIN vouch_tags vt ON vt.id = vtc.tag_id
     WHERE fv.vouch_from_id = $1
     GROUP BY fv.id, vouch_for.display_name, vouch_for.photos, vouch_for.primary_photo_index
     ORDER BY fv.created_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Get pending vouch requests
router.get('/requests/pending', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT vr.*, requester.display_name as requester_name,
            requester.photos as requester_photos,
            requester.primary_photo_index
     FROM vouch_requests vr
     LEFT JOIN profiles requester ON requester.user_id = vr.requested_by_id
     WHERE vr.requested_from_id = $1
       AND vr.status = 'pending'
     ORDER BY vr.created_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Get vouch requests sent by user
router.get('/requests/sent', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT vr.*, recipient.display_name as recipient_name,
            recipient.photos as recipient_photos,
            recipient.primary_photo_index
     FROM vouch_requests vr
     LEFT JOIN profiles recipient ON recipient.user_id = vr.requested_from_id
     WHERE vr.requested_by_id = $1
     ORDER BY vr.created_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Get available vouch tags
router.get('/tags', asyncHandler(async (req: AuthRequest, res) => {
  const { category } = req.query;

  let query = 'SELECT * FROM vouch_tags WHERE 1=1';
  const params: any[] = [];

  if (category) {
    params.push(category);
    query += ' AND tag_category = $' + params.length;
  }

  query += ' ORDER BY usage_count DESC, tag_name ASC';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

// Create a vouch for someone
router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const { vouch_for_id, relationship_type, known_for_years, vouch_text, anonymous, tag_ids } = req.body;

  if (!vouch_for_id) {
    throw new AppError('vouch_for_id is required', 400);
  }

  if (vouch_for_id === req.userId) {
    throw new AppError('Cannot vouch for yourself', 400);
  }

  // Check if user has already vouched for this person
  const existing = await pool.query(
    'SELECT * FROM friend_vouches WHERE vouch_for_id = $1 AND vouch_from_id = $2',
    [vouch_for_id, req.userId]
  );

  if (existing.rows.length > 0) {
    throw new AppError('You have already vouched for this user', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const vouchResult = await client.query(
      `INSERT INTO friend_vouches (vouch_for_id, vouch_from_id, relationship_type, known_for_years, vouch_text, anonymous, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'approved')
       RETURNING *`,
      [vouch_for_id, req.userId, relationship_type || 'friend', known_for_years || null, vouch_text || null, anonymous || false]
    );

    const vouch = vouchResult.rows[0];

    // Add tag connections
    if (tag_ids && Array.isArray(tag_ids) && tag_ids.length > 0) {
      for (const tagId of tag_ids) {
        await client.query(
          'INSERT INTO vouch_tag_connections (vouch_id, tag_id) VALUES ($1, $2)',
          [vouch.id, tagId]
        );
      }

      // Update tag usage counts
      await client.query(
        `UPDATE vouch_tags SET usage_count = usage_count + 1 WHERE id = ANY($1)`,
        [tag_ids]
      );
    }

    // Update stats
    await client.query(
      `INSERT INTO vouch_stats (user_id, total_vouches_received, last_vouch_received_at, trust_score, verification_level)
       VALUES ($1, 1, CURRENT_TIMESTAMP,
         CASE
           WHEN (SELECT COUNT(*) FROM friend_vouches WHERE vouch_for_id = $1 AND status = 'approved') >= 10 THEN 75.00
           WHEN (SELECT COUNT(*) FROM friend_vouches WHERE vouch_for_id = $1 AND status = 'approved') >= 5 THEN 50.00
           ELSE 25.00
         END,
         CASE
           WHEN (SELECT COUNT(*) FROM friend_vouches WHERE vouch_for_id = $1 AND status = 'approved') >= 10 THEN 'highly_trusted'
           WHEN (SELECT COUNT(*) FROM friend_vouches WHERE vouch_for_id = $1 AND status = 'approved') >= 3 THEN 'verified'
           ELSE 'basic'
         END)
       ON CONFLICT (user_id)
       DO UPDATE SET
         total_vouches_received = vouch_stats.total_vouches_received + 1,
         last_vouch_received_at = CURRENT_TIMESTAMP,
         trust_score = CASE
           WHEN vouch_stats.total_vouches_received + 1 >= 10 THEN 75.00
           WHEN vouch_stats.total_vouches_received + 1 >= 5 THEN 50.00
           ELSE LEAST(vouch_stats.trust_score + 10, 100.00)
         END,
         verification_level = CASE
           WHEN vouch_stats.total_vouches_received + 1 >= 10 THEN 'highly_trusted'
           WHEN vouch_stats.total_vouches_received + 1 >= 3 THEN 'verified'
           ELSE 'basic'
         END,
         updated_at = CURRENT_TIMESTAMP`,
      [vouch_for_id]
    );

    await client.query(
      `INSERT INTO vouch_stats (user_id, total_vouches_given, last_vouch_given_at)
       VALUES ($1, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET
         total_vouches_given = vouch_stats.total_vouches_given + 1,
         last_vouch_given_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [req.userId]
    );

    await client.query('COMMIT');

    res.json(vouch);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Request a vouch from someone
router.post('/request', asyncHandler(async (req: AuthRequest, res) => {
  const { requested_from_id, message } = req.body;

  if (!requested_from_id) {
    throw new AppError('requested_from_id is required', 400);
  }

  if (requested_from_id === req.userId) {
    throw new AppError('Cannot request vouch from yourself', 400);
  }

  // Check if request already exists
  const existing = await pool.query(
    'SELECT * FROM vouch_requests WHERE requested_by_id = $1 AND requested_from_id = $2 AND status = $3',
    [req.userId, requested_from_id, 'pending']
  );

  if (existing.rows.length > 0) {
    throw new AppError('Vouch request already pending', 400);
  }

  const result = await pool.query(
    `INSERT INTO vouch_requests (requested_by_id, requested_from_id, message)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [req.userId, requested_from_id, message || null]
  );

  // Update stats
  await pool.query(
    `INSERT INTO vouch_stats (user_id, total_vouch_requests_sent)
     VALUES ($1, 1)
     ON CONFLICT (user_id)
     DO UPDATE SET total_vouch_requests_sent = vouch_stats.total_vouch_requests_sent + 1`,
    [req.userId]
  );

  await pool.query(
    `INSERT INTO vouch_stats (user_id, total_vouch_requests_received)
     VALUES ($1, 1)
     ON CONFLICT (user_id)
     DO UPDATE SET total_vouch_requests_received = vouch_stats.total_vouch_requests_received + 1`,
    [requested_from_id]
  );

  res.json(result.rows[0]);
}));

// Respond to vouch request
router.post('/request/:requestId/respond', asyncHandler(async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const { status, vouch_data } = req.body;

  if (!['accepted', 'declined'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  // Verify request exists and is for this user
  const requestCheck = await pool.query(
    'SELECT * FROM vouch_requests WHERE id = $1 AND requested_from_id = $2',
    [requestId, req.userId]
  );

  if (requestCheck.rows.length === 0) {
    throw new AppError('Request not found', 404);
  }

  const request = requestCheck.rows[0];

  await pool.query(
    `UPDATE vouch_requests
     SET status = $1, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [status, requestId]
  );

  // If accepted, create the vouch
  if (status === 'accepted' && vouch_data) {
    const { relationship_type, known_for_years, vouch_text, anonymous, tag_ids } = vouch_data;

    const vouchResult = await pool.query(
      `INSERT INTO friend_vouches (vouch_for_id, vouch_from_id, relationship_type, known_for_years, vouch_text, anonymous, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'approved')
       RETURNING *`,
      [request.requested_by_id, req.userId, relationship_type || 'friend', known_for_years || null, vouch_text || null, anonymous || false]
    );

    const vouch = vouchResult.rows[0];

    // Add tag connections
    if (tag_ids && Array.isArray(tag_ids) && tag_ids.length > 0) {
      for (const tagId of tag_ids) {
        await pool.query(
          'INSERT INTO vouch_tag_connections (vouch_id, tag_id) VALUES ($1, $2)',
          [vouch.id, tagId]
        );
      }
    }
  }

  res.json({ success: true });
}));

// React to a vouch
router.post('/:vouchId/react', asyncHandler(async (req: AuthRequest, res) => {
  const { vouchId } = req.params;
  const { reaction_type = 'helpful' } = req.body;

  // Check if vouch exists
  const vouchCheck = await pool.query(
    'SELECT * FROM friend_vouches WHERE id = $1',
    [vouchId]
  );

  if (vouchCheck.rows.length === 0) {
    throw new AppError('Vouch not found', 404);
  }

  // Check if user already reacted
  const existing = await pool.query(
    'SELECT * FROM vouch_reactions WHERE vouch_id = $1 AND user_id = $2',
    [vouchId, req.userId]
  );

  if (existing.rows.length > 0) {
    // Update reaction
    await pool.query(
      'UPDATE vouch_reactions SET reaction_type = $1 WHERE vouch_id = $2 AND user_id = $3',
      [reaction_type, vouchId, req.userId]
    );
  } else {
    // Insert reaction
    await pool.query(
      'INSERT INTO vouch_reactions (vouch_id, user_id, reaction_type) VALUES ($1, $2, $3)',
      [vouchId, req.userId, reaction_type]
    );

    // Update stats
    await pool.query(
      `INSERT INTO vouch_stats (user_id, total_reactions_received)
       VALUES ((SELECT vouch_for_id FROM friend_vouches WHERE id = $1), 1)
       ON CONFLICT (user_id)
       DO UPDATE SET total_reactions_received = vouch_stats.total_reactions_received + 1`,
      [vouchId]
    );
  }

  res.json({ success: true });
}));

// Remove own vouch
router.delete('/:vouchId', asyncHandler(async (req: AuthRequest, res) => {
  const { vouchId } = req.params;

  const vouchCheck = await pool.query(
    'SELECT * FROM friend_vouches WHERE id = $1 AND vouch_from_id = $2',
    [vouchId, req.userId]
  );

  if (vouchCheck.rows.length === 0) {
    throw new AppError('Vouch not found or not authorized', 404);
  }

  await pool.query(
    'DELETE FROM friend_vouches WHERE id = $1',
    [vouchId]
  );

  res.json({ success: true });
}));

// Cancel vouch request
router.post('/request/:requestId/cancel', asyncHandler(async (req: AuthRequest, res) => {
  const { requestId } = req.params;

  const requestCheck = await pool.query(
    'SELECT * FROM vouch_requests WHERE id = $1 AND requested_by_id = $2',
    [requestId, req.userId]
  );

  if (requestCheck.rows.length === 0) {
    throw new AppError('Request not found or not authorized', 404);
  }

  await pool.query(
    'UPDATE vouch_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    ['cancelled', requestId]
  );

  res.json({ success: true });
}));

// Get vouch stats for a user
router.get('/stats/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;

  let result = await pool.query(
    'SELECT * FROM vouch_stats WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    result = await pool.query(
      `INSERT INTO vouch_stats (user_id) VALUES ($1) RETURNING *`,
      [userId]
    );
  }

  res.json(result.rows[0]);
}));

export default router;
