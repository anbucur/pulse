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

  try {
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    req.user = { id: decoded.userId || decoded.sub };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Get user's body map
router.get('/', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM body_maps WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        zones: {},
        shared_with_matches: false
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching body map:', error);
    res.status(500).json({ error: 'Failed to fetch body map' });
  }
});

// Get body map for a matched user (only if shared)
router.get('/:userId', authenticateToken, async (req: any, res: any) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;

    // Verify users are matched
    const matchCheck = await pool.query(
      `SELECT 1 FROM matches
      WHERE (user1_id = $1 AND user2_id = $2)
         OR (user1_id = $2 AND user2_id = $1)
      LIMIT 1`,
      [currentUserId, userId]
    );

    if (matchCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not matched with this user' });
    }

    const result = await pool.query(
      'SELECT zones, shared_with_matches FROM body_maps WHERE user_id = $1 AND shared_with_matches = true',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Body map not shared' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching partner body map:', error);
    res.status(500).json({ error: 'Failed to fetch body map' });
  }
});

// Create or update body map
router.post('/', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { zones, shared_with_matches } = req.body;

    if (!zones || typeof zones !== 'object') {
      return res.status(400).json({ error: 'zones object required' });
    }

    const result = await pool.query(
      `INSERT INTO body_maps (user_id, zones, shared_with_matches)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id)
      DO UPDATE SET
        zones = EXCLUDED.zones,
        shared_with_matches = EXCLUDED.shared_with_matches
      RETURNING *`,
      [userId, zones, shared_with_matches || false]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving body map:', error);
    res.status(500).json({ error: 'Failed to save body map' });
  }
});

// Update sharing settings
router.patch('/share', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { shared_with_matches } = req.body;

    if (typeof shared_with_matches !== 'boolean') {
      return res.status(400).json({ error: 'shared_with_matches must be a boolean' });
    }

    const result = await pool.query(
      `UPDATE body_maps
      SET shared_with_matches = $1
      WHERE user_id = $2
      RETURNING *`,
      [shared_with_matches, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Body map not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating sharing settings:', error);
    res.status(500).json({ error: 'Failed to update sharing settings' });
  }
});

// Delete body map
router.delete('/', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM body_maps WHERE user_id = $1',
      [userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting body map:', error);
    res.status(500).json({ error: 'Failed to delete body map' });
  }
});

export default router;
