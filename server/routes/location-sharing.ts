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

// ============ TRUSTED CONTACTS ============

// Get all trusted contacts
router.get('/contacts', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT * FROM trusted_contacts
     WHERE user_id = $1 AND active = true
     ORDER BY priority DESC, contact_name ASC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Add a trusted contact
router.post('/contacts', asyncHandler(async (req: AuthRequest, res) => {
  const {
    contact_name,
    contact_phone,
    contact_email,
    relationship,
    priority = 0,
    can_receive_location = true,
    can_receive_emergency = true,
    can_request_checkin = true,
    notes
  } = req.body;

  if (!contact_name) {
    throw new AppError('contact_name is required', 400);
  }

  const result = await pool.query(
    `INSERT INTO trusted_contacts
     (user_id, contact_name, contact_phone, contact_email, relationship,
      priority, can_receive_location, can_receive_emergency, can_request_checkin, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      req.userId,
      contact_name,
      contact_phone || null,
      contact_email || null,
      relationship || null,
      priority,
      can_receive_location,
      can_receive_emergency,
      can_request_checkin,
      notes || null
    ]
  );

  // Log to history
  await pool.query(
    `INSERT INTO location_sharing_history
     (user_id, action, details, ip_address)
     VALUES ($1, 'add_contact', $2, $3)`,
    [req.userId, JSON.stringify({ contactId: result.rows[0].id }), req.ip]
  );

  res.json(result.rows[0]);
}));

// Update a trusted contact
router.patch('/contacts/:contactId', asyncHandler(async (req: AuthRequest, res) => {
  const { contactId } = req.params;
  const updates = req.body;

  // Verify ownership
  const contactCheck = await pool.query(
    'SELECT * FROM trusted_contacts WHERE id = $1 AND user_id = $2',
    [contactId, req.userId]
  );

  if (contactCheck.rows.length === 0) {
    throw new AppError('Contact not found', 404);
  }

  const setClause = [];
  const values = [];
  let paramCount = 1;

  const allowedFields = [
    'contact_name', 'contact_phone', 'contact_email', 'relationship',
    'priority', 'can_receive_location', 'can_receive_emergency',
    'can_request_checkin', 'notes', 'is_verified'
  ];

  for (const field of allowedFields) {
    if (field in updates) {
      setClause.push(`${field} = $${paramCount}`);
      values.push(updates[field]);
      paramCount++;
    }
  }

  if (setClause.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  values.push(contactId, req.userId);

  const result = await pool.query(
    `UPDATE trusted_contacts
     SET ${setClause.join(', ')}, updated_at = NOW()
     WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
     RETURNING *`,
    values
  );

  res.json(result.rows[0]);
}));

// Delete a trusted contact
router.delete('/contacts/:contactId', asyncHandler(async (req: AuthRequest, res) => {
  const { contactId } = req.params;

  const result = await pool.query(
    `UPDATE trusted_contacts
     SET active = false, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [contactId, req.userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Contact not found', 404);
  }

  res.json({ success: true });
}));

// ============ LOCATION SHARING ============

// Get active location shares
router.get('/shares/active', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT ls.*, (SELECT COUNT(*) FROM location_updates WHERE share_id = ls.id) as update_count
     FROM location_shares ls
     WHERE ls.user_id = $1 AND ls.is_active = true
     ORDER BY ls.share_started_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Start a new location share session
router.post('/shares', asyncHandler(async (req: AuthRequest, res) => {
  const {
    share_name,
    share_type = 'date',
    share_ends_at,
    date_partner_id,
    date_location
  } = req.body;

  const result = await pool.query(
    `INSERT INTO location_shares
     (user_id, share_name, share_type, share_ends_at, date_partner_id, date_location)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      req.userId,
      share_name || null,
      share_type,
      share_ends_at || null,
      date_partner_id || null,
      date_location || null
    ]
  );

  // Get trusted contacts who should receive location
  const contacts = await pool.query(
    `SELECT * FROM trusted_contacts
     WHERE user_id = $1 AND active = true AND can_receive_location = true`,
    [req.userId]
  );

  // Log to history
  await pool.query(
    `INSERT INTO location_sharing_history
     (user_id, share_id, action, details, ip_address)
     VALUES ($1, $2, 'start_share', $3, $4)`,
    [req.userId, result.rows[0].id, JSON.stringify({ shareType: share_type }), req.ip]
  );

  res.json({
    share: result.rows[0],
    contactsNotified: contacts.rows.length
  });
}));

// Update location during active share
router.post('/shares/:shareId/location', asyncHandler(async (req: AuthRequest, res) => {
  const { shareId } = req.params;
  const {
    latitude,
    longitude,
    accuracy,
    altitude,
    speed,
    heading,
    battery_level,
    is_moving = false
  } = req.body;

  if (latitude === undefined || longitude === undefined) {
    throw new AppError('latitude and longitude are required', 400);
  }

  // Verify share ownership and that it's active
  const shareCheck = await pool.query(
    'SELECT * FROM location_shares WHERE id = $1 AND user_id = $2 AND is_active = true',
    [shareId, req.userId]
  );

  if (shareCheck.rows.length === 0) {
    throw new AppError('Active share not found', 404);
  }

  const result = await pool.query(
    `INSERT INTO location_updates
     (share_id, latitude, longitude, accuracy, altitude, speed, heading,
      battery_level, is_moving)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      shareId,
      latitude,
      longitude,
      accuracy || null,
      altitude || null,
      speed || null,
      heading || null,
      battery_level || null,
      is_moving
    ]
  );

  res.json(result.rows[0]);
}));

// End a location share
router.post('/shares/:shareId/end', asyncHandler(async (req: AuthRequest, res) => {
  const { shareId } = req.params;

  const result = await pool.query(
    `UPDATE location_shares
     SET is_active = false, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [shareId, req.userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Share not found', 404);
  }

  res.json({ success: true });
}));

// ============ CHECK-IN REQUESTS ============

// Get pending check-in requests
router.get('/checkins/pending', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT cir.*, tc.contact_name
     FROM check_in_requests cir
     LEFT JOIN trusted_contacts tc ON tc.id = cir.requested_by_contact_id
     WHERE cir.user_id = $1 AND cir.status = 'pending'
     ORDER BY cir.due_by ASC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Create a check-in request
router.post('/checkins', asyncHandler(async (req: AuthRequest, res) => {
  const {
    request_type = 'manual',
    scheduled_for,
    due_by,
    message
  } = req.body;

  if (!due_by && !scheduled_for) {
    throw new AppError('due_by or scheduled_for is required', 400);
  }

  const result = await pool.query(
    `INSERT INTO check_in_requests
     (user_id, request_type, scheduled_for, due_by, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      req.userId,
      request_type,
      scheduled_for || null,
      due_by,
      message || null
    ]
  );

  res.json(result.rows[0]);
}));

// Respond to a check-in request
router.post('/checkins/:requestId/respond', asyncHandler(async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  const {
    response_text,
    location_shared = false,
    latitude,
    longitude
  } = req.body;

  // Verify request ownership
  const requestCheck = await pool.query(
    'SELECT * FROM check_in_requests WHERE id = $1 AND user_id = $2',
    [requestId, req.userId]
  );

  if (requestCheck.rows.length === 0) {
    throw new AppError('Check-in request not found', 404);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add response
    await client.query(
      `INSERT INTO check_in_responses
       (request_id, response_text, location_shared, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        requestId,
        response_text || null,
        location_shared,
        latitude || null,
        longitude || null
      ]
    );

    // Update request status
    await client.query(
      `UPDATE check_in_requests
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [requestId]
    );

    await client.query('COMMIT');

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Cancel a check-in request
router.delete('/checkins/:requestId', asyncHandler(async (req: AuthRequest, res) => {
  const { requestId } = req.params;

  await pool.query(
    `UPDATE check_in_requests
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [requestId, req.userId]
  );

  res.json({ success: true });
}));

// ============ EMERGENCY BROADCASTS ============

// Create an emergency broadcast (SOS)
router.post('/emergency', asyncHandler(async (req: AuthRequest, res) => {
  const {
    broadcast_type = 'sos',
    message,
    latitude,
    longitude,
    location_accuracy,
    share_id
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create broadcast
    const broadcastResult = await client.query(
      `INSERT INTO emergency_broadcasts
       (user_id, share_id, broadcast_type, message, latitude, longitude, location_accuracy)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.userId,
        share_id || null,
        broadcast_type,
        message || null,
        latitude || null,
        longitude || null,
        location_accuracy || null
      ]
    );

    const broadcast = broadcastResult.rows[0];

    // Get contacts who should be notified
    const contacts = await client.query(
      `SELECT * FROM trusted_contacts
       WHERE user_id = $1 AND active = true AND can_receive_emergency = true`,
      [req.userId]
    );

    // Create notification records for each contact
    for (const contact of contacts.rows) {
      const method = contact.contact_phone ? 'sms' : 'push';
      const destination = contact.contact_phone || contact.contact_email;

      await client.query(
        `INSERT INTO emergency_notifications
         (broadcast_id, contact_id, notification_method, destination)
         VALUES ($1, $2, $3, $4)`,
        [broadcast.id, contact.id, method, destination]
      );
    }

    // Update broadcast with contacts notified count
    await client.query(
      `UPDATE emergency_broadcasts
       SET contacts_notified = $1
       WHERE id = $2`,
      [contacts.rows.length, broadcast.id]
    );

    // If location was provided, update location_sent flag
    if (latitude && longitude) {
      await client.query(
        `UPDATE emergency_broadcasts
         SET location_sent = true
         WHERE id = $1`,
        [broadcast.id]
      );
    }

    await client.query('COMMIT');

    res.json({
      broadcast,
      contactsNotified: contacts.rows.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Resolve an emergency broadcast
router.post('/emergency/:broadcastId/resolve', asyncHandler(async (req: AuthRequest, res) => {
  const { broadcastId } = req.params;
  const { status = 'resolved', resolution_notes } = req.body;

  if (!['resolved', 'false_alarm'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const result = await pool.query(
    `UPDATE emergency_broadcasts
     SET status = $1, resolved_at = NOW(), resolution_notes = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [status, resolution_notes || null, broadcastId, req.userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Broadcast not found', 404);
  }

  // Log to history
  await pool.query(
    `INSERT INTO location_sharing_history
     (user_id, share_id, action, details, ip_address)
     VALUES ($1, $2, 'resolve_emergency', $3, $4)`,
    [req.userId, broadcastId, JSON.stringify({ status }), req.ip]
  );

  res.json(result.rows[0]);
}));

// Get active emergency broadcasts
router.get('/emergency/active', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT * FROM emergency_broadcasts
     WHERE user_id = $1 AND status = 'active'
     ORDER BY created_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// ============ SCHEDULED RULES ============

// Get scheduled sharing rules
router.get('/scheduled-rules', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT * FROM scheduled_sharing_rules
     WHERE user_id = $1 AND active = true
     ORDER BY start_time ASC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Create a scheduled sharing rule
router.post('/scheduled-rules', asyncHandler(async (req: AuthRequest, res) => {
  const {
    rule_name,
    start_time,
    end_time,
    days_of_week = '0,1,2,3,4,5,6',
    auto_activate = true,
    share_with_verified_contacts = true,
    share_with_contacts
  } = req.body;

  if (!rule_name || !start_time || !end_time) {
    throw new AppError('rule_name, start_time, and end_time are required', 400);
  }

  const result = await pool.query(
    `INSERT INTO scheduled_sharing_rules
     (user_id, rule_name, start_time, end_time, days_of_week,
      auto_activate, share_with_verified_contacts, share_with_contacts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      req.userId,
      rule_name,
      start_time,
      end_time,
      days_of_week,
      auto_activate,
      share_with_verified_contacts,
      share_with_contacts || null
    ]
  );

  res.json(result.rows[0]);
}));

// Delete a scheduled rule
router.delete('/scheduled-rules/:ruleId', asyncHandler(async (req: AuthRequest, res) => {
  const { ruleId } = req.params;

  await pool.query(
    `UPDATE scheduled_sharing_rules
     SET active = false, updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [ruleId, req.userId]
  );

  res.json({ success: true });
}));

// ============ HISTORY ============

// Get location sharing history
router.get('/history', asyncHandler(async (req: AuthRequest, res) => {
  const { limit = '50', offset = '0' } = req.query;

  const result = await pool.query(
    `SELECT * FROM location_sharing_history
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.userId, limit, offset]
  );

  res.json(result.rows);
}));

export default router;
