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

// Get all blueprints for user (created or participating in)
router.get('/', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = `
      SELECT
        fb.*,
        p.display_name as creator_name,
        p.primary_photo_index,
        p.photos
      FROM fantasy_blueprints fb
      LEFT JOIN profiles p ON fb.created_by = p.user_id
      WHERE $1 = ANY(fb.participant_ids)
    `;
    const params: any[] = [userId];

    if (status) {
      query += ' AND fb.status = $2';
      params.push(status);
    }

    query += ' ORDER BY fb.updated_at DESC';

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching blueprints:', error);
    res.status(500).json({ error: 'Failed to fetch blueprints' });
  }
});

// Get single blueprint with contributions
router.get('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Get blueprint
    const blueprintResult = await pool.query(
      `SELECT
        fb.*,
        p.display_name as creator_name,
        p.primary_photo_index,
        p.photos
      FROM fantasy_blueprints fb
      LEFT JOIN profiles p ON fb.created_by = p.user_id
      WHERE fb.id = $1`,
      [id]
    );

    if (blueprintResult.rows.length === 0) {
      return res.status(404).json({ error: 'Blueprint not found' });
    }

    const blueprint = blueprintResult.rows[0];

    // Verify user is participant
    if (!blueprint.participant_ids.includes(userId)) {
      return res.status(403).json({ error: 'Not authorized to view this blueprint' });
    }

    // Get contributions
    const contributionsResult = await pool.query(
      `SELECT
        bc.*,
        p.display_name as contributor_name
      FROM blueprint_contributions bc
      LEFT JOIN profiles p ON bc.user_id = p.user_id
      WHERE bc.blueprint_id = $1
      ORDER BY bc.created_at ASC`,
      [id]
    );

    // Get participant profiles
    const participantsResult = await pool.query(
      `SELECT user_id, display_name, primary_photo_index, photos
      FROM profiles
      WHERE user_id = ANY($1)`,
      [blueprint.participant_ids]
    );

    res.json({
      ...blueprint,
      contributions: contributionsResult.rows,
      participants: participantsResult.rows
    });
  } catch (error) {
    console.error('Error fetching blueprint:', error);
    res.status(500).json({ error: 'Failed to fetch blueprint' });
  }
});

// Create new blueprint
router.post('/', authenticateToken, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const {
      title,
      description,
      participantIds,
      scenarioType,
      mood,
      pace,
      content,
      allowEdits,
      requireApproval,
      isVisibleToAll,
      isPrivate,
      passcode,
      scheduledFor,
      locationPreference
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: 'At least one participant is required' });
    }

    // Add creator to participants if not already included
    const allParticipants = [...new Set([userId, ...participantIds])];

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO fantasy_blueprints (
        created_by, title, description, participant_ids, scenario_type, mood, pace,
        content, allow_edits, require_approval, is_visible_to_all,
        is_private, passcode, scheduled_for, location_preference
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        userId,
        title,
        description || null,
        allParticipants,
        scenarioType || null,
        mood || null,
        pace || null,
        content || {},
        allowEdits !== undefined ? allowEdits : true,
        requireApproval !== undefined ? requireApproval : false,
        isVisibleToAll !== undefined ? isVisibleToAll : true,
        isPrivate || false,
        passcode || null,
        scheduledFor || null,
        locationPreference || null
      ]
    );

    // Log creation as contribution
    await client.query(
      `INSERT INTO blueprint_contributions (
        blueprint_id, user_id, action, section_affected, new_value, change_description
      )
      VALUES ($1, $2, 'created', 'blueprint', $3, $4)`,
      [
        result.rows[0].id,
        userId,
        JSON.stringify(result.rows[0]),
        'Created blueprint'
      ]
    );

    await client.query('COMMIT');

    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating blueprint:', error);
    res.status(500).json({ error: 'Failed to create blueprint' });
  } finally {
    client.release();
  }
});

// Update blueprint content
router.patch('/:id', authenticateToken, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      title,
      description,
      scenarioType,
      mood,
      pace,
      content,
      scheduledFor,
      locationPreference,
      status,
      everyoneAgreed
    } = req.body;

    await client.query('BEGIN');

    // Get current blueprint
    const currentResult = await client.query(
      'SELECT * FROM fantasy_blueprints WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Blueprint not found' });
    }

    const current = currentResult.rows[0];

    // Verify user is participant
    if (!current.participant_ids.includes(userId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if edits are allowed
    if (!current.allow_edits && current.created_by !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Edits not allowed' });
    }

    // Build update
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }
    if (scenarioType !== undefined) {
      updates.push(`scenario_type = $${paramCount}`);
      values.push(scenarioType);
      paramCount++;
    }
    if (mood !== undefined) {
      updates.push(`mood = $${paramCount}`);
      values.push(mood);
      paramCount++;
    }
    if (pace !== undefined) {
      updates.push(`pace = $${paramCount}`);
      values.push(pace);
      paramCount++;
    }
    if (content !== undefined) {
      updates.push(`content = $${paramCount}`);
      values.push(content);
      paramCount++;
    }
    if (scheduledFor !== undefined) {
      updates.push(`scheduled_for = $${paramCount}`);
      values.push(scheduledFor);
      paramCount++;
    }
    if (locationPreference !== undefined) {
      updates.push(`location_preference = $${paramCount}`);
      values.push(locationPreference);
      paramCount++;
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }
    if (everyoneAgreed !== undefined) {
      updates.push(`everyone_agreed = $${paramCount}`);
      values.push(everyoneAgreed);
      paramCount++;
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(id);

    const result = await client.query(
      `UPDATE fantasy_blueprints
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *`,
      values
    );

    // Log contribution
    await client.query(
      `INSERT INTO blueprint_contributions (
        blueprint_id, user_id, action, section_affected, new_value, change_description
      )
      VALUES ($1, $2, 'updated', 'blueprint', $3, $4)`,
      [
        id,
        userId,
        JSON.stringify(req.body),
        'Updated blueprint'
      ]
    );

    await client.query('COMMIT');

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating blueprint:', error);
    res.status(500).json({ error: 'Failed to update blueprint' });
  } finally {
    client.release();
  }
});

// Update specific section content
router.patch('/:id/content', authenticateToken, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { section, content, previousContent } = req.body;

    if (!section || content === undefined) {
      return res.status(400).json({ error: 'section and content required' });
    }

    await client.query('BEGIN');

    // Get current blueprint
    const currentResult = await client.query(
      'SELECT * FROM fantasy_blueprints WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Blueprint not found' });
    }

    const current = currentResult.rows[0];

    // Verify user is participant
    if (!current.participant_ids.includes(userId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update content
    const updatedContent = {
      ...current.content,
      [section]: content
    };

    const result = await client.query(
      `UPDATE fantasy_blueprints
      SET content = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *`,
      [JSON.stringify(updatedContent), id]
    );

    // Log contribution
    await client.query(
      `INSERT INTO blueprint_contributions (
        blueprint_id, user_id, action, section_affected, previous_value, new_value
      )
      VALUES ($1, $2, 'updated_section', $3, $4, $5)`,
      [
        id,
        userId,
        section,
        previousContent ? JSON.stringify(previousContent) : null,
        JSON.stringify(content)
      ]
    );

    await client.query('COMMIT');

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating content:', error);
    res.status(500).json({ error: 'Failed to update content' });
  } finally {
    client.release();
  }
});

// Add agreement
router.post('/:id/agree', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE fantasy_blueprints
      SET agreements = COALESCE(agreements, '[]'::uuid[]) || $1
      WHERE id = $2 AND $3 = ANY(participant_ids)
      RETURNING *`,
      [userId, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Blueprint not found or not authorized' });
    }

    // Check if everyone has agreed
    const allAgreed = result.rows[0].participant_ids.every((pid: string) =>
      result.rows[0].agreements?.includes(pid)
    );

    if (allAgreed) {
      await pool.query(
        `UPDATE fantasy_blueprints
        SET everyone_agreed = true
        WHERE id = $1`,
        [id]
      );
    }

    res.json({ success: true, allAgreed });
  } catch (error) {
    console.error('Error adding agreement:', error);
    res.status(500).json({ error: 'Failed to add agreement' });
  }
});

// Remove agreement
router.delete('/:id/agree', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE fantasy_blueprints
      SET agreements = array_remove(agreements, $1), everyone_agreed = false
      WHERE id = $2
      RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Blueprint not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing agreement:', error);
    res.status(500).json({ error: 'Failed to remove agreement' });
  }
});

// Add participant
router.post('/:id/participants', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required' });
    }

    const result = await pool.query(
      `UPDATE fantasy_blueprints
      SET participant_ids = participant_ids || $1, everyone_agreed = false
      WHERE id = $2 AND created_by = $3
      RETURNING *`,
      [participantId, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Blueprint not found or not authorized' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

// Remove participant
router.delete('/:id/participants/:participantId', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id, participantId } = req.params;

    const result = await pool.query(
      `UPDATE fantasy_blueprints
      SET participant_ids = array_remove(participant_ids, $1::uuid), everyone_agreed = false
      WHERE id = $2 AND created_by = $3
      RETURNING *`,
      [participantId, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Blueprint not found or not authorized' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// Delete blueprint (soft delete)
router.delete('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE fantasy_blueprints
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND created_by = $2
      RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Blueprint not found or not authorized' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting blueprint:', error);
    res.status(500).json({ error: 'Failed to delete blueprint' });
  }
});

// Get blueprint contributions
router.get('/:id/contributions', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify access
    const blueprintResult = await pool.query(
      'SELECT * FROM fantasy_blueprints WHERE id = $1 AND $2 = ANY(participant_ids)',
      [id, userId]
    );

    if (blueprintResult.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await pool.query(
      `SELECT
        bc.*,
        p.display_name as contributor_name
      FROM blueprint_contributions bc
      LEFT JOIN profiles p ON bc.user_id = p.user_id
      WHERE bc.blueprint_id = $1
      ORDER BY bc.created_at ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching contributions:', error);
    res.status(500).json({ error: 'Failed to fetch contributions' });
  }
});

export default router;
