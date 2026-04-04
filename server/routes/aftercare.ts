/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { pool } from '../config/index.js';

const router = express.Router();

// Middleware to verify authentication
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // For now, just set a user ID from the token
  // In production, verify the JWT properly
  try {
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    req.user = { id: decoded.userId || decoded.sub };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Get all check-ins for current user
router.get('/', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        ac.*,
        dp.user1_id,
        dp.user2_id,
        dp.scheduled_date,
        dp.met_at,
        dp.status as date_status,
        u1.display_name as user1_name,
        u2.display_name as user2_name,
        p1.photos as user1_photos,
        p1.primary_photo_index as user1_photo_index,
        p2.photos as user2_photos,
        p2.primary_photo_index as user2_photo_index
      FROM aftercare_checkins ac
      JOIN date_pairs dp ON ac.date_pair_id = dp.id
      JOIN users u1 ON dp.user1_id = u1.id
      JOIN users u2 ON dp.user2_id = u2.id
      LEFT JOIN profiles p1 ON u1.id = p1.user_id
      LEFT JOIN profiles p2 ON u2.id = p2.user_id
      WHERE ac.user_id = $1
      ORDER BY ac.submitted_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

// Get pending check-ins (dates that happened but no check-in yet)
router.get('/pending', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        dp.*,
        u1.display_name as user1_name,
        u2.display_name as user2_name,
        p1.photos as user1_photos,
        p1.primary_photo_index as user1_photo_index,
        p2.photos as user2_photos,
        p2.primary_photo_index as user2_photo_index,
        EXISTS(SELECT 1 FROM aftercare_checkins WHERE date_pair_id = dp.id AND user_id = $1) as has_submitted
      FROM date_pairs dp
      JOIN users u1 ON dp.user1_id = u1.id
      JOIN users u2 ON dp.user2_id = u2.id
      LEFT JOIN profiles p1 ON u1.id = p1.user_id
      LEFT JOIN profiles p2 ON u2.id = p2.user_id
      WHERE (dp.user1_id = $1 OR dp.user2_id = $1)
        AND dp.status = 'met'
        AND dp.met_at IS NOT NULL
        AND NOT EXISTS(
          SELECT 1 FROM aftercare_checkins
          WHERE date_pair_id = dp.id AND user_id = $1
        )
      ORDER BY dp.met_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pending check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch pending check-ins' });
  }
});

// Get check-in details and partner's response (if both submitted)
router.get('/:datePairId', authenticateToken, async (req: any, res: any) => {
  try {
    const { datePairId } = req.params;
    const userId = req.user.id;

    // Verify user is part of this date pair
    const pairCheck = await pool.query(
      'SELECT * FROM date_pairs WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [datePairId, userId]
    );

    if (pairCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Date pair not found' });
    }

    // Get both check-ins
    const checkinsResult = await pool.query(
      `SELECT
        ac.*,
        u.display_name,
        p.photos,
        p.primary_photo_index
      FROM aftercare_checkins ac
      JOIN users u ON ac.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE ac.date_pair_id = $1`,
      [datePairId]
    );

    const checkins = checkinsResult.rows;
    const myCheckin = checkins.find((c: any) => c.user_id === userId);
    const partnerCheckin = checkins.find((c: any) => c.user_id !== userId);

    // Only show partner's check-in if both have submitted and both rated high
    let showPartnerCheckin = false;
    if (myCheckin && partnerCheckin) {
      if (myCheckin.rating >= 4 && partnerCheckin.rating >= 4 && myCheckin.would_see_again && partnerCheckin.would_see_again) {
        showPartnerCheckin = true;
      }
    }

    res.json({
      datePair: pairCheck.rows[0],
      myCheckin,
      partnerCheckin: showPartnerCheckin ? partnerCheckin : null,
      bothSubmitted: checkins.length === 2,
      mutualMatch: showPartnerCheckin
    });
  } catch (error) {
    console.error('Error fetching check-in details:', error);
    res.status(500).json({ error: 'Failed to fetch check-in details' });
  }
});

// Create or update check-in
router.post('/:datePairId', authenticateToken, async (req: any, res: any) => {
  const client = await pool.connect();

  try {
    const { datePairId } = req.params;
    const userId = req.user.id;

    const {
      rating,
      would_see_again,
      felt_safe,
      what_went_well,
      could_improve,
      boundaries_respected,
      communication_rating,
      safety_concerns,
      safety_report,
      report_anonymous,
      wants_second_date,
      second_date_suggestions
    } = req.body;

    // Verify user is part of this date pair
    const pairCheck = await client.query(
      'SELECT * FROM date_pairs WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [datePairId, userId]
    );

    if (pairCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Date pair not found' });
    }

    await client.query('BEGIN');

    // Upsert check-in
    const result = await client.query(
      `INSERT INTO aftercare_checkins (
        date_pair_id,
        user_id,
        rating,
        would_see_again,
        felt_safe,
        what_went_well,
        could_improve,
        boundaries_respected,
        communication_rating,
        safety_concerns,
        safety_report,
        report_anonymous,
        wants_second_date,
        second_date_suggestions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (date_pair_id, user_id)
      DO UPDATE SET
        rating = EXCLUDED.rating,
        would_see_again = EXCLUDED.would_see_again,
        felt_safe = EXCLUDED.felt_safe,
        what_went_well = EXCLUDED.what_went_well,
        could_improve = EXCLUDED.could_improve,
        boundaries_respected = EXCLUDED.boundaries_respected,
        communication_rating = EXCLUDED.communication_rating,
        safety_concerns = EXCLUDED.safety_concerns,
        safety_report = EXCLUDED.safety_report,
        report_anonymous = EXCLUDED.report_anonymous,
        wants_second_date = EXCLUDED.wants_second_date,
        second_date_suggestions = EXCLUDED.second_date_suggestions
      RETURNING *`,
      [
        datePairId,
        userId,
        rating,
        would_see_again,
        felt_safe,
        what_went_well || [],
        could_improve || [],
        boundaries_respected,
        communication_rating,
        safety_concerns || false,
        safety_report,
        report_anonymous || true,
        wants_second_date || false,
        second_date_suggestions || []
      ]
    );

    // Check if both submitted and both rated high for second date suggestion
    const checkinsResult = await client.query(
      'SELECT * FROM aftercare_checkins WHERE date_pair_id = $1',
      [datePairId]
    );

    let mutualMatch = false;
    if (checkinsResult.rows.length === 2) {
      const [checkin1, checkin2] = checkinsResult.rows;
      if (checkin1.rating >= 4 && checkin2.rating >= 4 &&
          checkin1.would_see_again && checkin2.would_see_again) {
        mutualMatch = true;
      }
    }

    // Handle safety report
    if (safety_concerns && safety_report) {
      // Create notification for admins
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, data)
        SELECT id, 'safety_report', 'Safety Report Filed', 'A new safety report has been submitted', $1::jsonb
        FROM users WHERE role = 'admin'`,
        [{ datePairId, userId, anonymous: report_anonymous }]
      );
    }

    await client.query('COMMIT');

    res.json({
      checkin: result.rows[0],
      mutualMatch,
      bothSubmitted: checkinsResult.rows.length === 2
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating check-in:', error);
    res.status(500).json({ error: 'Failed to create check-in' });
  } finally {
    client.release();
  }
});

// Create date pair (for when a date is scheduled)
router.post('/pairs/create', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { target_user_id, scheduled_date } = req.body;

    if (!target_user_id || !scheduled_date) {
      return res.status(400).json({ error: 'target_user_id and scheduled_date required' });
    }

    // Ensure consistent ordering
    const [user1_id, user2_id] = [userId, target_user_id].sort();

    const result = await pool.query(
      `INSERT INTO date_pairs (user1_id, user2_id, scheduled_date, status)
      VALUES ($1, $2, $3, 'scheduled')
      ON CONFLICT (user1_id, user2_id, scheduled_date)
      DO NOTHING
      RETURNING *`,
      [user1_id, user2_id, scheduled_date]
    );

    if (result.rows.length === 0) {
      // Date pair already exists
      const existing = await pool.query(
        'SELECT * FROM date_pairs WHERE user1_id = $1 AND user2_id = $2 AND scheduled_date = $3',
        [user1_id, user2_id, scheduled_date]
      );
      return res.json(existing.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating date pair:', error);
    res.status(500).json({ error: 'Failed to create date pair' });
  }
});

// Mark date as met
router.post('/pairs/:datePairId/met', authenticateToken, async (req: any, res: any) => {
  try {
    const { datePairId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE date_pairs
      SET met_at = CURRENT_TIMESTAMP, status = 'met'
      WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)
      RETURNING *`,
      [datePairId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Date pair not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking date as met:', error);
    res.status(500).json({ error: 'Failed to mark date as met' });
  }
});

// Get safety resources
router.get('/resources/safety', (req: any, res: any) => {
  const resources = [
    {
      name: 'National Sexual Assault Hotline (US)',
      description: '24/7 confidential support',
      phone: '1-800-656-4673',
      website: 'https://www.rainn.org'
    },
    {
      name: 'National Domestic Violence Hotline (US)',
      description: '24/7 support for domestic violence',
      phone: '1-800-799-7233',
      website: 'https://www.thehotline.org'
    },
    {
      name: 'Crisis Text Line',
      description: '24/7 crisis support via text',
      phone: 'Text HOME to 741741',
      website: 'https://www.crisistextline.org'
    }
  ];

  res.json(resources);
});

export default router;
