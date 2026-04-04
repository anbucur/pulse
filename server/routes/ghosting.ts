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

// Get ghosting pledge status for a match
router.get('/pledge/:matchId', asyncHandler(async (req: AuthRequest, res) => {
  const { matchId } = req.params;

  // Verify match exists
  const matchCheck = await pool.query(
    'SELECT * FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
    [matchId, req.userId]
  );

  if (matchCheck.rows.length === 0) {
    throw new AppError('Match not found', 404);
  }

  const result = await pool.query(
    'SELECT * FROM ghosting_pledges WHERE match_id = $1',
    [matchId]
  );

  if (result.rows.length === 0) {
    // Create new pledge
    const newPledge = await pool.query(
      `INSERT INTO ghosting_pledges (match_id, user1_id, user2_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [matchId, matchCheck.rows[0].user1_id, matchCheck.rows[0].user2_id]
    );
    return res.json(newPledge.rows[0]);
  }

  res.json(result.rows[0]);
}));

// Agree to pledge
router.post('/pledge/:matchId/agree', asyncHandler(async (req: AuthRequest, res) => {
  const { matchId } = req.params;
  const { response_expectation_hours = 48 } = req.body;

  if (![24, 48, 72].includes(response_expectation_hours)) {
    throw new AppError('Invalid response expectation', 400);
  }

  // Verify match and get user position
  const matchCheck = await pool.query(
    'SELECT * FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
    [matchId, req.userId]
  );

  if (matchCheck.rows.length === 0) {
    throw new AppError('Match not found', 404);
  }

  const isUser1 = matchCheck.rows[0].user1_id === req.userId;
  const userColumn = isUser1 ? 'user1_pledge_status' : 'user2_pledge_status';

  const result = await pool.query(
    `UPDATE ghosting_pledges
     SET ${userColumn} = 'agreed',
         response_expectation_hours = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE match_id = $1
     RETURNING *`,
    [matchId, req.userId, response_expectation_hours]
  );

  // Check if both agreed
  const pledge = result.rows[0];
  if (pledge.user1_pledge_status === 'agreed' && pledge.user2_pledge_status === 'agreed' && !pledge.both_agreed_at) {
    await pool.query(
      `UPDATE ghosting_pledges
       SET both_agreed_at = CURRENT_TIMESTAMP,
           pledge_active = true
       WHERE match_id = $1`,
      [matchId]
    );

    // Update metrics for both users
    await pool.query(
      `UPDATE ghost_metrics
       SET pledges_agreed = ghost_metrics.pledges_agreed + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id IN ($1, $2)`,
      [pledge.user1_id, pledge.user2_id]
    );
  }

  res.json(pledge);
}));

// Decline or revoke pledge
router.post('/pledge/:matchId/decline', asyncHandler(async (req: AuthRequest, res) => {
  const { matchId } = req.params;

  // Verify match
  const matchCheck = await pool.query(
    'SELECT * FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
    [matchId, req.userId]
  );

  if (matchCheck.rows.length === 0) {
    throw new AppError('Match not found', 404);
  }

  const isUser1 = matchCheck.rows[0].user1_id === req.userId;
  const userColumn = isUser1 ? 'user1_pledge_status' : 'user2_pledge_status';

  await pool.query(
    `UPDATE ghosting_pledges
     SET ${userColumn} = 'declined',
         pledge_active = false,
         updated_at = CURRENT_TIMESTAMP
     WHERE match_id = $1`,
    [matchId]
  );

  res.json({ success: true });
}));

// Get user's ghosting metrics
router.get('/metrics', asyncHandler(async (req: AuthRequest, res) => {
  let result = await pool.query(
    'SELECT * FROM ghost_metrics WHERE user_id = $1',
    [req.userId]
  );

  if (result.rows.length === 0) {
    result = await pool.query(
      `INSERT INTO ghost_metrics (user_id) VALUES ($1) RETURNING *`,
      [req.userId]
    );
  }

  res.json(result.rows[0]);
}));

// Get active nudges for user
router.get('/nudges', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT rn.*, m.content as message_content,
            p1.display_name as sender_name, p1.photos as sender_photos,
            p2.display_name as recipient_name
     FROM response_nudges rn
     JOIN matches mtc ON mtc.id = rn.match_id
     LEFT JOIN messages m ON m.id = rn.message_id
     LEFT JOIN profiles p1 ON p1.user_id = rn.sender_id
     LEFT JOIN profiles p2 ON p2.user_id = rn.recipient_id
     WHERE rn.recipient_id = $1
       AND rn.status IN ('pending', 'sent', 'delivered')
     ORDER BY rn.scheduled_for ASC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Get sent nudges (for the sender to see)
router.get('/nudges/sent', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT rn.*, p.display_name as recipient_name
     FROM response_nudges rn
     JOIN profiles p ON p.user_id = rn.recipient_id
     WHERE rn.sender_id = $1
     ORDER BY rn.created_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Manually trigger a nudge
router.post('/nudges/:matchId/trigger', asyncHandler(async (req: AuthRequest, res) => {
  const { matchId } = req.params;
  const { nudge_type, custom_message } = req.body;

  // Verify match
  const matchCheck = await pool.query(
    'SELECT * FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
    [matchId, req.userId]
  );

  if (matchCheck.rows.length === 0) {
    throw new AppError('Match not found', 404);
  }

  const otherUserId = matchCheck.rows[0].user1_id === req.userId
    ? matchCheck.rows[0].user2_id
    : matchCheck.rows[0].user1_id;

  const validTypes = ['24h_reminder', '48h_reminder', '72h_reminder', 'friendly_check', 'pledge_reminder', 'gentle_nudge'];
  if (!validTypes.includes(nudge_type)) {
    throw new AppError('Invalid nudge type', 400);
  }

  // Create nudge
  const result = await pool.query(
    `INSERT INTO response_nudges
     (match_id, sender_id, recipient_id, nudge_type, scheduled_for, status, is_automated, custom_message)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'sent', false, $5)
     RETURNING *`,
    [matchId, otherUserId, req.userId, nudge_type, custom_message || null]
  );

  res.json(result.rows[0]);
}));

// Update last seen
router.post('/last-seen', asyncHandler(async (req: AuthRequest, res) => {
  const { action = 'active' } = req.body;

  const result = await pool.query(
    `INSERT INTO user_last_seen (user_id, last_active_at, is_online, online_status_updated_at)
     VALUES ($1, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id)
     DO UPDATE SET
       last_active_at = CURRENT_TIMESTAMP,
       is_online = true,
       online_status_updated_at = CURRENT_TIMESTAMP,
       ${action === 'chat_opened' ? 'last_chat_opened_at = CURRENT_TIMESTAMP,' : ''}
       ${action === 'profile_view' ? 'last_profile_view_at = CURRENT_TIMESTAMP,' : ''}
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [req.userId]
  );

  res.json(result.rows[0]);
}));

// Get last seen for a user
router.get('/last-seen/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;

  const result = await pool.query(
    'SELECT * FROM user_last_seen WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return res.json({
      user_id: userId,
      last_active_at: null,
      is_online: false
    });
  }

  const lastSeen = result.rows[0];

  // Calculate if user should be shown as online
  const lastActive = new Date(lastSeen.last_active_at);
  const minutesSince = (Date.now() - lastActive.getTime()) / (1000 * 60);
  const isOnline = minutesSince < 5 && lastSeen.is_online;

  res.json({
    ...lastSeen,
    is_online: isOnline
  });
}));

// Record message read receipt
router.post('/read-receipt/:messageId', asyncHandler(async (req: AuthRequest, res) => {
  const { messageId } = req.params;

  // Verify message is in a conversation involving this user
  const messageCheck = await pool.query(
    `SELECT m.* FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.id = $1 AND (c.user1_id = $2 OR c.user2_id = $2)`,
    [messageId, req.userId]
  );

  if (messageCheck.rows.length === 0) {
    throw new AppError('Message not found', 404);
  }

  const message = messageCheck.rows[0];
  const timeToRead = message.created_at
    ? Math.floor((Date.now() - new Date(message.created_at).getTime()) / 1000)
    : null;

  const result = await pool.query(
    `INSERT INTO message_read_receipts (message_id, reader_id, delivered_at, time_to_read_seconds)
     VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
     ON CONFLICT (message_id, reader_id)
     DO UPDATE SET read_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [messageId, req.userId, timeToRead]
  );

  res.json(result.rows[0]);
}));

// Background job to schedule nudges (would be run by cron)
router.post('/schedule-nudges', asyncHandler(async (req: AuthRequest, res) => {
  // This would typically be called by a cron job
  // Find active pledges with no response
  const pledges = await pool.query(
    `SELECT gp.*, m.id as match_id,
       CASE
         WHEN gp.user1_id = m.last_message_from_id THEN gp.user2_id
         ELSE gp.user1_id
       END as waiting_user_id,
       CASE
         WHEN gp.user1_id = m.last_message_from_id THEN gp.user1_id
         ELSE gp.user2_id
       END as last_sender_id,
       m.last_message_at
     FROM ghosting_pledges gp
     JOIN matches m ON m.id = gp.match_id
     WHERE gp.pledge_active = true
       AND m.last_message_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
       AND NOT EXISTS (
         SELECT 1 FROM response_nudges rn
         WHERE rn.match_id = m.id
         AND rn.scheduled_for > CURRENT_TIMESTAMP - INTERVAL '24 hours'
       )`
  );

  for (const pledge of pledges.rows) {
    const hoursSince = (Date.now() - new Date(pledge.last_message_at).getTime()) / (1000 * 60 * 60);

    if (hoursSince >= 24 && hoursSince < 48) {
      await pool.query(
        `INSERT INTO response_nudges (match_id, sender_id, recipient_id, nudge_type, scheduled_for, status, is_automated)
         VALUES ($1, $2, $3, '24h_reminder', CURRENT_TIMESTAMP, 'pending', true)`,
        [pledge.match_id, pledge.last_sender_id, pledge.waiting_user_id]
      );
    } else if (hoursSince >= 48 && hoursSince < 72) {
      await pool.query(
        `INSERT INTO response_nudges (match_id, sender_id, recipient_id, nudge_type, scheduled_for, status, is_automated)
         VALUES ($1, $2, $3, '48h_reminder', CURRENT_TIMESTAMP, 'pending', true)`,
        [pledge.match_id, pledge.last_sender_id, pledge.waiting_user_id]
      );
    } else if (hoursSince >= 72) {
      await pool.query(
        `INSERT INTO response_nudges (match_id, sender_id, recipient_id, nudge_type, scheduled_for, status, is_automated)
         VALUES ($1, $2, $3, '72h_reminder', CURRENT_TIMESTAMP, 'pending', true)`,
        [pledge.match_id, pledge.last_sender_id, pledge.waiting_user_id]
      );

      // Record broken pledge
      await pool.query(
        `UPDATE ghost_metrics
         SET pledges_broken = pledges_broken + 1,
             broken_pledge_incidents = array_append(broken_pledge_incidents, $1::text),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [pledge.match_id, pledge.waiting_user_id]
      );

      // Deactivate pledge
      await pool.query(
        `UPDATE ghosting_pledges
         SET pledge_active = false
         WHERE match_id = $1`,
        [pledge.match_id]
      );
    }
  }

  res.json({ scheduled: pledges.rows.length });
}));

export default router;
