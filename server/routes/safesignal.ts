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

// Get active safe signal status
router.get('/status', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM safe_signals WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ isActive: false });
    }

    res.json({
      isActive: true,
      activatedAt: result.rows[0].activated_at,
      location: {
        latitude: result.rows[0].latitude,
        longitude: result.rows[0].longitude,
        accuracy: result.rows[0].location_accuracy,
        updatedAt: result.rows[0].location_updated_at
      },
      isRecording: result.rows[0].is_recording,
      recordingUrl: result.rows[0].recording_url,
      statusNotes: result.rows[0].status_notes,
      lastCheckIn: result.rows[0].last_check_in,
      contactsNotified: result.rows[0].emergency_contacts_notified
    });
  } catch (error) {
    console.error('Error fetching safe signal status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Activate SOS (panic button)
router.post('/sos', authenticateToken, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const {
      latitude,
      longitude,
      locationAccuracy,
      wasOnDate,
      datePartnerId,
      dateLocation
    } = req.body;

    await client.query('BEGIN');

    // Create or update safe signal
    const signalResult = await client.query(
      `INSERT INTO safe_signals (
        user_id, is_active, activated_at, latitude, longitude, location_accuracy, location_updated_at
      )
      VALUES ($1, true, CURRENT_TIMESTAMP, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        is_active = true,
        activated_at = CURRENT_TIMESTAMP,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        location_accuracy = EXCLUDED.location_accuracy,
        location_updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [userId, latitude, longitude, locationAccuracy]
    );

    const safeSignalId = signalResult.rows[0].id;

    // Create SOS alert record
    const alertResult = await client.query(
      `INSERT INTO sos_alerts (
        user_id, safe_signal_id, latitude, longitude, was_on_date, date_partner_id, date_location
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [userId, safeSignalId, latitude, longitude, wasOnDate || false, datePartnerId || null, dateLocation || null]
    );

    // Get trusted contacts to notify
    const contactsResult = await client.query(
      'SELECT * FROM trusted_contacts WHERE user_id = $1 AND notify_on_sos = true ORDER BY priority ASC',
      [userId]
    );

    const contactsToNotify = contactsResult.rows.map((c: any) => c.id);

    // Update safe signal with notified contacts
    if (contactsToNotify.length > 0) {
      await client.query(
        `UPDATE safe_signals
        SET emergency_contacts_notified = $1, notifications_sent_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
        [contactsToNotify, safeSignalId]
      );

      // Update SOS alert
      await client.query(
        `UPDATE sos_alerts
        SET contacts_notified = $1
        WHERE id = $2`,
        [contactsToNotify, alertResult.rows[0].id]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      safeSignalId,
      alertId: alertResult.rows[0].id,
      contactsNotified: contactsToNotify.length,
      contacts: contactsResult.rows
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error activating SOS:', error);
    res.status(500).json({ error: 'Failed to activate SOS' });
  } finally {
    client.release();
  }
});

// Update location during active SOS
router.patch('/location', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, accuracy } = req.body;

    const result = await pool.query(
      `UPDATE safe_signals
      SET latitude = $1, longitude = $2, location_accuracy = $3, location_updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $4 AND is_active = true
      RETURNING *`,
      [latitude, longitude, accuracy, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active SOS found' });
    }

    res.json({ success: true, updatedAt: result.rows[0].location_updated_at });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Trigger fake call
router.post('/fake-call', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { phoneNumber } = req.body;

    // Get active SOS alert
    const alertResult = await pool.query(
      `SELECT id FROM sos_alerts
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
      [userId]
    );

    if (alertResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active SOS found' });
    }

    // Update alert with fake call triggered
    await pool.query(
      `UPDATE sos_alerts
      SET fake_call_triggered = true, fake_call_number = $2
      WHERE id = $1`,
      [alertResult.rows[0].id, phoneNumber || null]
    );

    res.json({ success: true, triggerTime: new Date().toISOString() });
  } catch (error) {
    console.error('Error triggering fake call:', error);
    res.status(500).json({ error: 'Failed to trigger fake call' });
  }
});

// Start recording
router.post('/recording/start', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE safe_signals
      SET is_recording = true, recording_started_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_active = true
      RETURNING *`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active SOS found' });
    }

    // Also update SOS alert
    await pool.query(
      `UPDATE sos_alerts
      SET recording_started = true
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
      [userId]
    );

    res.json({ success: true, startedAt: result.rows[0].recording_started_at });
  } catch (error) {
    console.error('Error starting recording:', error);
    res.status(500).json({ error: 'Failed to start recording' });
  }
});

// Save recording URL
router.post('/recording/save', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { recordingUrl } = req.body;

    const result = await pool.query(
      `UPDATE safe_signals
      SET recording_url = $1, is_recording = false
      WHERE user_id = $1 AND is_active = true
      RETURNING *`,
      [recordingUrl, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active SOS found' });
    }

    res.json({ success: true, recordingUrl: result.rows[0].recording_url });
  } catch (error) {
    console.error('Error saving recording:', error);
    res.status(500).json({ error: 'Failed to save recording' });
  }
});

// Check-in during SOS
router.post('/checkin', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { notes } = req.body;

    const result = await pool.query(
      `UPDATE safe_signals
      SET last_check_in = CURRENT_TIMESTAMP, status_notes = COALESCE($2, status_notes)
      WHERE user_id = $1 AND is_active = true
      RETURNING *`,
      [userId, notes]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active SOS found' });
    }

    res.json({ success: true, checkedInAt: result.rows[0].last_check_in });
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// Deactivate SOS
router.post('/deactivate', authenticateToken, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { resolutionNotes, followUpNeeded } = req.body;

    await client.query('BEGIN');

    // Get active SOS alert
    const alertResult = await client.query(
      `SELECT id FROM sos_alerts
      WHERE user_id = $1 AND resolved_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
      [userId]
    );

    // Deactivate safe signal
    await client.query(
      `UPDATE safe_signals
      SET is_active = false, deactivated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_active = true`,
      [userId]
    );

    // Resolve SOS alert
    if (alertResult.rows.length > 0) {
      await client.query(
        `UPDATE sos_alerts
        SET resolved_at = CURRENT_TIMESTAMP, resolution_notes = $2, follow_up_needed = $3
        WHERE id = $1`,
        [alertResult.rows[0].id, resolutionNotes || null, followUpNeeded || false]
      );
    }

    await client.query('COMMIT');

    res.json({ success: true, deactivatedAt: new Date().toISOString() });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deactivating SOS:', error);
    res.status(500).json({ error: 'Failed to deactivate SOS' });
  } finally {
    client.release();
  }
});

// Get trusted contacts
router.get('/contacts', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM trusted_contacts WHERE user_id = $1 ORDER BY priority ASC, created_at ASC',
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching trusted contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Add trusted contact
router.post('/contacts', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const {
      contactName,
      contactPhone,
      contactEmail,
      relationship,
      priority,
      notifyOnSos,
      shareLocation
    } = req.body;

    if (!contactName) {
      return res.status(400).json({ error: 'contactName is required' });
    }

    const result = await pool.query(
      `INSERT INTO trusted_contacts (
        user_id, contact_name, contact_phone, contact_email, relationship, priority, notify_on_sos, share_location
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        userId,
        contactName,
        contactPhone || null,
        contactEmail || null,
        relationship || null,
        priority || 0,
        notifyOnSos !== undefined ? notifyOnSos : true,
        shareLocation !== undefined ? shareLocation : true
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding trusted contact:', error);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

// Update trusted contact
router.patch('/contacts/:contactId', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { contactId } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateFields.push(`${dbField} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(userId, contactId);

    const result = await pool.query(
      `UPDATE trusted_contacts
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $${paramCount} AND id = $${paramCount + 1}
      RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating trusted contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Delete trusted contact
router.delete('/contacts/:contactId', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { contactId } = req.params;

    const result = await pool.query(
      'DELETE FROM trusted_contacts WHERE user_id = $1 AND id = $2 RETURNING *',
      [userId, contactId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting trusted contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// Get SOS alert history
router.get('/history', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { limit = '10' } = req.query;

    const result = await pool.query(
      `SELECT
        sa.*,
        ss.is_recording,
        ss.recording_url,
        u1.display_name as date_partner_name
      FROM sos_alerts sa
      LEFT JOIN safe_signals ss ON sa.safe_signal_id = ss.id
      LEFT JOIN users u1 ON sa.date_partner_id = u1.id
      WHERE sa.user_id = $1
      ORDER BY sa.created_at DESC
      LIMIT $2`,
      [userId, parseInt(limit as string)]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching SOS history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
