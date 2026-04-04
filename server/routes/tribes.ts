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

// Get all tribes (with filtering)
router.get('/', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { category, search } = req.query;

    let query = `
      SELECT
        t.*,
        u.display_name as creator_name,
        EXISTS(SELECT 1 FROM tribe_members WHERE tribe_id = t.id AND user_id = $1) as is_member,
        COALESCE(tm.role, 'none') as user_role,
        tm.status as membership_status
      FROM tribes t
      JOIN users u ON t.created_by = u.id
      LEFT JOIN tribe_members tm ON t.id = tm.tribe_id AND tm.user_id = $1
      WHERE (t.is_private = false OR tm.user_id IS NOT NULL)
    `;

    const params: any[] = [userId];
    let paramCount = 1;

    if (category) {
      paramCount++;
      query += ` AND t.category = $${paramCount}`;
      params.push(category);
    }

    if (search) {
      paramCount++;
      query += ` AND (t.name ILIKE $${paramCount} OR t.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY t.member_count DESC, t.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tribes:', error);
    res.status(500).json({ error: 'Failed to fetch tribes' });
  }
});

// Get user's tribes
router.get('/my-tribes', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        t.*,
        tm.role,
        tm.status as membership_status,
        tm.joined_at
      FROM tribes t
      JOIN tribe_members tm ON t.id = tm.tribe_id
      WHERE tm.user_id = $1 AND tm.status = 'active'
      ORDER BY tm.joined_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user tribes:', error);
    res.status(500).json({ error: 'Failed to fetch user tribes' });
  }
});

// Get single tribe with details
router.get('/:tribeId', authenticateToken, async (req: any, res: any) => {
  try {
    const { tribeId } = req.params;
    const userId = req.user.id;

    const tribeResult = await pool.query(
      `SELECT
        t.*,
        u.display_name as creator_name,
        EXISTS(SELECT 1 FROM tribe_members WHERE tribe_id = t.id AND user_id = $2) as is_member,
        tm.role as user_role,
        tm.status as membership_status
      FROM tribes t
      JOIN users u ON t.created_by = u.id
      LEFT JOIN tribe_members tm ON t.id = tm.tribe_id AND tm.user_id = $2
      WHERE t.id = $1`,
      [tribeId, userId]
    );

    if (tribeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tribe not found' });
    }

    const tribe = tribeResult.rows[0];

    // Only show details if member or public
    if (tribe.is_private && !tribe.is_member) {
      return res.status(403).json({ error: 'Private tribe' });
    }

    res.json(tribe);
  } catch (error) {
    console.error('Error fetching tribe:', error);
    res.status(500).json({ error: 'Failed to fetch tribe' });
  }
});

// Get tribe members
router.get('/:tribeId/members', authenticateToken, async (req: any, res: any) => {
  try {
    const { tribeId } = req.params;
    const userId = req.user.id;

    // Verify user is member
    const memberCheck = await pool.query(
      'SELECT * FROM tribe_members WHERE tribe_id = $1 AND user_id = $2 AND status = \'active\'',
      [tribeId, userId]
    );

    if (memberCheck.rows.length === 0) {
      // Check if tribe is public
      const tribeCheck = await pool.query('SELECT is_private FROM tribes WHERE id = $1', [tribeId]);
      if (tribeCheck.rows.length === 0 || tribeCheck.rows[0].is_private) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await pool.query(
      `SELECT
        tm.*,
        u.display_name,
        p.photos,
        p.primary_photo_index,
        p.bio
      FROM tribe_members tm
      JOIN users u ON tm.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE tm.tribe_id = $1 AND tm.status = 'active'
      ORDER BY
        CASE tm.role
          WHEN 'admin' THEN 1
          WHEN 'moderator' THEN 2
          ELSE 3
        END,
        tm.joined_at ASC`,
      [tribeId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tribe members:', error);
    res.status(500).json({ error: 'Failed to fetch tribe members' });
  }
});

// Get tribe messages
router.get('/:tribeId/messages', authenticateToken, async (req: any, res: any) => {
  try {
    const { tribeId } = req.params;
    const userId = req.user.id;

    // Verify user is member
    const memberCheck = await pool.query(
      'SELECT * FROM tribe_members WHERE tribe_id = $1 AND user_id = $2 AND status = \'active\'',
      [tribeId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Must be a member to view messages' });
    }

    const result = await pool.query(
      `SELECT
        tm.*,
        u.display_name,
        p.photos,
        p.primary_photo_index
      FROM tribe_messages tm
      JOIN users u ON tm.sender_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE tm.tribe_id = $1 AND tm.deleted_at IS NULL
      ORDER BY tm.is_pinned DESC, tm.created_at DESC
      LIMIT 100`,
      [tribeId]
    );

    res.json(result.rows.reverse());
  } catch (error) {
    console.error('Error fetching tribe messages:', error);
    res.status(500).json({ error: 'Failed to fetch tribe messages' });
  }
});

// Get tribe events
router.get('/:tribeId/events', authenticateToken, async (req: any, res: any) => {
  try {
    const { tribeId } = req.params;
    const userId = req.user.id;

    // Verify access
    const memberCheck = await pool.query(
      'SELECT * FROM tribe_members WHERE tribe_id = $1 AND user_id = $2 AND status = \'active\'',
      [tribeId, userId]
    );

    if (memberCheck.rows.length === 0) {
      const tribeCheck = await pool.query('SELECT is_private FROM tribes WHERE id = $1', [tribeId]);
      if (tribeCheck.rows.length === 0 || tribeCheck.rows[0].is_private) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await pool.query(
      `SELECT
        te.*,
        u.display_name as creator_name,
        EXISTS(SELECT 1 FROM tribe_event_attendees WHERE tribe_event_id = te.id AND user_id = $2) as is_attending
      FROM tribe_events te
      JOIN users u ON te.created_by = u.id
      WHERE te.tribe_id = $1 AND te.status != 'cancelled'
      ORDER BY te.event_date ASC`,
      [tribeId, userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tribe events:', error);
    res.status(500).json({ error: 'Failed to fetch tribe events' });
  }
});

// Create tribe
router.post('/', authenticateToken, async (req: any, res: any) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const {
      name,
      description,
      category,
      tags,
      location,
      is_location_based,
      latitude,
      longitude,
      icon,
      color,
      is_private,
      approval_required,
      max_members,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO tribes (
        created_by, name, description, slug, category, tags,
        location, is_location_based, latitude, longitude,
        icon, color, is_private, approval_required, max_members
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        userId,
        name,
        description,
        slug,
        category || 'community',
        tags || [],
        location,
        is_location_based || false,
        latitude,
        longitude,
        icon || 'users',
        color || '#ec4899',
        is_private || false,
        approval_required || false,
        max_members,
      ]
    );

    const tribe = result.rows[0];

    // Add creator as admin member
    await client.query(
      `INSERT INTO tribe_members (tribe_id, user_id, role, status, joined_at, approved_at)
      VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [tribe.id, userId]
    );

    await client.query('COMMIT');

    res.json(tribe);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating tribe:', error);
    res.status(500).json({ error: 'Failed to create tribe' });
  } finally {
    client.release();
  }
});

// Join tribe
router.post('/:tribeId/join', authenticateToken, async (req: any, res: any) => {
  try {
    const { tribeId } = req.params;
    const userId = req.user.id;

    // Get tribe details
    const tribeResult = await pool.query('SELECT * FROM tribes WHERE id = $1', [tribeId]);

    if (tribeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tribe not found' });
    }

    const tribe = tribeResult.rows[0];

    // Check if already member
    const existingMember = await pool.query(
      'SELECT * FROM tribe_members WHERE tribe_id = $1 AND user_id = $2',
      [tribeId, userId]
    );

    if (existingMember.rows.length > 0) {
      return res.status(400).json({ error: 'Already a member' });
    }

    // Check max members
    if (tribe.max_members) {
      const memberCount = await pool.query(
        'SELECT COUNT(*) FROM tribe_members WHERE tribe_id = $1 AND status = \'active\'',
        [tribeId]
      );
      if (parseInt(memberCount.rows[0].count) >= tribe.max_members) {
        return res.status(400).json({ error: 'Tribe is full' });
      }
    }

    // Add member
    const status = tribe.approval_required ? 'pending' : 'active';
    const result = await pool.query(
      `INSERT INTO tribe_members (tribe_id, user_id, role, status, joined_at${status === 'active' ? ', approved_at' : ''})
      VALUES ($1, $2, 'member', $3, CURRENT_TIMESTAMP${status === 'active' ? ', CURRENT_TIMESTAMP' : ''})
      RETURNING *`,
      [tribeId, userId, status]
    );

    if (status === 'active') {
      // Update member count
      await pool.query(
        'UPDATE tribes SET member_count = member_count + 1 WHERE id = $1',
        [tribeId]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error joining tribe:', error);
    res.status(500).json({ error: 'Failed to join tribe' });
  }
});

// Leave tribe
router.post('/:tribeId/leave', authenticateToken, async (req: any, res: any) => {
  try {
    const { tribeId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE tribe_members
      SET status = 'left', left_at = CURRENT_TIMESTAMP
      WHERE tribe_id = $1 AND user_id = $2 AND status = 'active'
      RETURNING *`,
      [tribeId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not a member of this tribe' });
    }

    // Update member count
    await pool.query(
      'UPDATE tribes SET member_count = member_count - 1 WHERE id = $1',
      [tribeId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving tribe:', error);
    res.status(500).json({ error: 'Failed to leave tribe' });
  }
});

// Approve member (admin/moderator only)
router.post('/:tribeId/approve/:userId', authenticateToken, async (req: any, res: any) => {
  try {
    const { tribeId, userId } = req.params;
    const requesterId = req.user.id;

    // Check if requester is admin/moderator
    const roleCheck = await pool.query(
      'SELECT role FROM tribe_members WHERE tribe_id = $1 AND user_id = $2 AND status = \'active\'',
      [tribeId, requesterId]
    );

    if (roleCheck.rows.length === 0 || !['admin', 'moderator'].includes(roleCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await pool.query(
      `UPDATE tribe_members
      SET status = 'active', approved_at = CURRENT_TIMESTAMP
      WHERE tribe_id = $1 AND user_id = $2 AND status = 'pending'
      RETURNING *`,
      [tribeId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found or already approved' });
    }

    // Update member count
    await pool.query(
      'UPDATE tribes SET member_count = member_count + 1 WHERE id = $1',
      [tribeId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error approving member:', error);
    res.status(500).json({ error: 'Failed to approve member' });
  }
});

// Send message
router.post('/:tribeId/messages', authenticateToken, async (req: any, res: any) => {
  try {
    const { tribeId } = req.params;
    const userId = req.user.id;
    const { content, reply_to } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Verify user is member
    const memberCheck = await pool.query(
      'SELECT * FROM tribe_members WHERE tribe_id = $1 AND user_id = $2 AND status = \'active\'',
      [tribeId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Must be a member to send messages' });
    }

    const result = await pool.query(
      `INSERT INTO tribe_messages (tribe_id, sender_id, content, reply_to)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [tribeId, userId, content.trim(), reply_to || null]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Create tribe event
router.post('/:tribeId/events', authenticateToken, async (req: any, res: any) => {
  try {
    const { tribeId } = req.params;
    const userId = req.user.id;
    const {
      title,
      description,
      event_date,
      venue_name,
      venue_address,
      location_url,
      max_attendees,
    } = req.body;

    if (!title || !event_date) {
      return res.status(400).json({ error: 'Title and event date are required' });
    }

    // Verify user is member
    const memberCheck = await pool.query(
      'SELECT * FROM tribe_members WHERE tribe_id = $1 AND user_id = $2 AND status = \'active\'',
      [tribeId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Must be a member to create events' });
    }

    const result = await pool.query(
      `INSERT INTO tribe_events (
        tribe_id, created_by, title, description, event_date,
        venue_name, venue_address, location_url, max_attendees
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        tribeId,
        userId,
        title,
        description,
        event_date,
        venue_name,
        venue_address,
        location_url,
        max_attendees,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating tribe event:', error);
    res.status(500).json({ error: 'Failed to create tribe event' });
  }
});

// RSVP to tribe event
router.post('/:tribeId/events/:eventId/rsvp', authenticateToken, async (req: any, res: any) => {
  const client = await pool.connect();

  try {
    const { tribeId, eventId } = req.params;
    const userId = req.user.id;
    const { status } = req.body;

    // Verify user is tribe member
    const memberCheck = await client.query(
      'SELECT * FROM tribe_members WHERE tribe_id = $1 AND user_id = $2 AND status = \'active\'',
      [tribeId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Must be a tribe member to RSVP' });
    }

    await client.query('BEGIN');

    // Check if already RSVP'd
    const existingRsvp = await client.query(
      'SELECT * FROM tribe_event_attendees WHERE tribe_event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    if (existingRsvp.rows.length > 0) {
      // Update existing RSVP
      await client.query(
        `UPDATE tribe_event_attendees
        SET status = $1
        WHERE tribe_event_id = $2 AND user_id = $3`,
        [status || 'attending', eventId, userId]
      );
    } else {
      // Create new RSVP
      await client.query(
        `INSERT INTO tribe_event_attendees (tribe_event_id, user_id, status)
        VALUES ($1, $2, $3)`,
        [eventId, userId, status || 'attending']
      );

      // Update attendee count
      await client.query(
        'UPDATE tribe_events SET attendee_count = attendee_count + 1 WHERE id = $1',
        [eventId]
      );
    }

    await client.query('COMMIT');

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error RSVPing to event:', error);
    res.status(500).json({ error: 'Failed to RSVP to event' });
  } finally {
    client.release();
  }
});

// Update member role (admin only)
router.put('/:tribeId/members/:userId/role', authenticateToken, async (req: any, res: any) => {
  try {
    const { tribeId, userId } = req.params;
    const requesterId = req.user.id;
    const { role } = req.body;

    // Check if requester is admin
    const roleCheck = await pool.query(
      'SELECT role FROM tribe_members WHERE tribe_id = $1 AND user_id = $2 AND status = \'active\'',
      [tribeId, requesterId]
    );

    if (roleCheck.rows.length === 0 || roleCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change roles' });
    }

    const result = await pool.query(
      `UPDATE tribe_members
      SET role = $1
      WHERE tribe_id = $2 AND user_id = $3 AND status = 'active'
      RETURNING *`,
      [role, tribeId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// Delete tribe (admin only)
router.delete('/:tribeId', authenticateToken, async (req: any, res: any) => {
  try {
    const { tribeId } = req.params;
    const userId = req.user.id;

    // Check if user is the creator or admin
    const tribeCheck = await pool.query(
      'SELECT created_by FROM tribes WHERE id = $1',
      [tribeId]
    );

    if (tribeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Tribe not found' });
    }

    const roleCheck = await pool.query(
      'SELECT role FROM tribe_members WHERE tribe_id = $1 AND user_id = $2 AND status = \'active\'',
      [tribeId, userId]
    );

    if (tribeCheck.rows[0].created_by !== userId || roleCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only tribe creator can delete tribe' });
    }

    await pool.query('DELETE FROM tribes WHERE id = $1', [tribeId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tribe:', error);
    res.status(500).json({ error: 'Failed to delete tribe' });
  }
});

export default router;
