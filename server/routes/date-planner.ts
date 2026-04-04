/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { pool } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

const router = Router();
router.use(authenticate);

// Get all date plans for current user
router.get('/plans', asyncHandler(async (req: AuthRequest, res) => {
  const { status, page = '1', limit = '20' } = req.query;

  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  let query = `
    SELECT
      dp.*,
      u1.display_name as user1_name,
      u2.display_name as user2_name,
      u1.photos as user1_photos,
      u2.photos as user2_photos,
      u1.primary_photo_index as user1_photo_index,
      u2.primary_photo_index as user2_photo_index,
      ml.title as venue_name,
      ml.images as venue_images
    FROM date_plans dp
    JOIN profiles u1 ON u1.user_id = dp.user1_id
    JOIN profiles u2 ON u2.user_id = dp.user2_id
    LEFT JOIN marketplace_listings ml ON ml.id = dp.venue_id
    WHERE (dp.user1_id = $1 OR dp.user2_id = $1)
  `;

  const params: any[] = [req.userId];
  let paramCount = 1;

  if (status) {
    paramCount++;
    query += ` AND dp.status = $${paramCount}`;
    params.push(status);
  }

  query += `
    ORDER BY dp.proposed_date_time ASC NULLS LAST, dp.created_at DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `;
  params.push(parseInt(limit as string), offset);

  const result = await pool.query(query, params);

  res.json({
    plans: result.rows,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    }
  });
}));

// Get a specific date plan
router.get('/plans/:planId', asyncHandler(async (req: AuthRequest, res) => {
  const { planId } = req.params;

  const result = await pool.query(`
    SELECT
      dp.*,
      u1.display_name as user1_name,
      u2.display_name as user2_name,
      u1.photos as user1_photos,
      u2.photos as user2_photos,
      u1.primary_photo_index as user1_photo_index,
      u2.primary_photo_index as user2_photo_index,
      ml.title as venue_name,
      ml.images as venue_images,
      ml.description as venue_description,
      ml.price as venue_price
    FROM date_plans dp
    JOIN profiles u1 ON u1.user_id = dp.user1_id
    JOIN profiles u2 ON u2.user_id = dp.user2_id
    LEFT JOIN marketplace_listings ml ON ml.id = dp.venue_id
    WHERE dp.id = $1 AND (dp.user1_id = $2 OR dp.user2_id = $2)
  `, [planId, req.userId]);

  if (result.rows.length === 0) {
    throw new AppError('Date plan not found', 404);
  }

  res.json(result.rows[0]);
}));

// Create a new date plan
router.post('/plans', asyncHandler(async (req: AuthRequest, res) => {
  const {
    user2_id,
    title,
    description,
    date_idea_type,
    proposed_date_time,
    duration_minutes,
    location_name,
    location_address,
    location_latitude,
    location_longitude,
    venue_id,
    estimated_budget
  } = req.body;

  if (!user2_id || !title) {
    throw new AppError('Missing required fields', 400);
  }

  const planId = randomUUID();

  const result = await pool.query(`
    INSERT INTO date_plans (
      plan_id, user1_id, user2_id, suggested_by, title, description,
      date_idea_type, proposed_date_time, duration_minutes,
      location_name, location_address, location_latitude, location_longitude,
      venue_id, estimated_budget, status
    )
    VALUES ($1, $2, $3, $2, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'proposed')
    RETURNING *
  `, [
    planId,
    req.userId,
    user2_id,
    title,
    description,
    date_idea_type || 'custom',
    proposed_date_time,
    duration_minutes || 120,
    location_name,
    location_address,
    location_latitude,
    location_longitude,
    venue_id,
    estimated_budget
  ]);

  res.status(201).json(result.rows[0]);
}));

// Update date plan
router.put('/plans/:planId', asyncHandler(async (req: AuthRequest, res) => {
  const { planId } = req.params;

  const {
    title,
    description,
    date_idea_type,
    proposed_date_time,
    duration_minutes,
    location_name,
    location_address,
    location_latitude,
    location_longitude,
    venue_id,
    estimated_budget
  } = req.body;

  const result = await pool.query(`
    UPDATE date_plans
    SET
      title = COALESCE($1, title),
      description = COALESCE($2, description),
      date_idea_type = COALESCE($3, date_idea_type),
      proposed_date_time = COALESCE($4, proposed_date_time),
      duration_minutes = COALESCE($5, duration_minutes),
      location_name = COALESCE($6, location_name),
      location_address = COALESCE($7, location_address),
      location_latitude = COALESCE($8, location_latitude),
      location_longitude = COALESCE($9, location_longitude),
      venue_id = COALESCE($10, venue_id),
      estimated_budget = COALESCE($11, estimated_budget),
      updated_at = NOW()
    WHERE id = $12 AND (user1_id = $13 OR user2_id = $13)
    RETURNING *
  `, [
    title,
    description,
    date_idea_type,
    proposed_date_time,
    duration_minutes,
    location_name,
    location_address,
    location_latitude,
    location_longitude,
    venue_id,
    estimated_budget,
    planId,
    req.userId
  ]);

  if (result.rows.length === 0) {
    throw new AppError('Date plan not found', 404);
  }

  res.json(result.rows[0]);
}));

// Confirm or decline date plan
router.post('/plans/:planId/confirm', asyncHandler(async (req: AuthRequest, res) => {
  const { planId } = req.params;
  const { confirmed } = req.body; // true to confirm, false to decline

  const planResult = await pool.query(
    'SELECT * FROM date_plans WHERE id = $1',
    [planId]
  );

  if (planResult.rows.length === 0) {
    throw new AppError('Date plan not found', 404);
  }

  const plan = planResult.rows[0];
  const isUser1 = plan.user1_id === req.userId;
  const confirmField = isUser1 ? 'user1_confirmed' : 'user2_confirmed';

  if (confirmed === false) {
    // Decline - cancel the plan
    await pool.query(`
      UPDATE date_plans
      SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = 'Declined by participant'
      WHERE id = $1
    `, [planId]);

    return res.json({ success: true, status: 'cancelled' });
  }

  // Confirm
  await pool.query(`
    UPDATE date_plans
    SET
      ${confirmField} = true,
      status = CASE
        WHEN user1_confirmed = true AND user2_confirmed = true THEN 'confirmed'
        WHEN user1_confirmed = true OR user2_confirmed = true THEN 'pending_confirmation'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = $1
  `, [planId]);

  const updatedPlan = await pool.query(
    'SELECT * FROM date_plans WHERE id = $1',
    [planId]
  );

  res.json(updatedPlan.rows[0]);
}));

// Cancel date plan
router.post('/plans/:planId/cancel', asyncHandler(async (req: AuthRequest, res) => {
  const { planId } = req.params;
  const { reason } = req.body;

  await pool.query(`
    UPDATE date_plans
    SET
      status = 'cancelled',
      cancelled_at = NOW(),
      cancellation_reason = $1
    WHERE id = $2 AND (user1_id = $3 OR user2_id = $3)
  `, [reason || 'Cancelled by user', planId, req.userId]);

  res.json({ success: true });
}));

// Get date plan messages
router.get('/plans/:planId/messages', asyncHandler(async (req: AuthRequest, res) => {
  const { planId } = req.params;

  const result = await pool.query(`
    SELECT
      dpm.*,
      p.display_name as sender_name
    FROM date_plan_messages dpm
    JOIN profiles p ON p.user_id = dpm.sender_id
    WHERE dpm.plan_id = $1
    ORDER BY dpm.created_at ASC
  `, [planId]);

  res.json(result.rows);
}));

// Send date plan message
router.post('/plans/:planId/messages', asyncHandler(async (req: AuthRequest, res) => {
  const { planId } = req.params;
  const { message_type = 'message', content, metadata } = req.body;

  if (!content && message_type === 'message') {
    throw new AppError('Message content is required', 400);
  }

  const result = await pool.query(`
    INSERT INTO date_plan_messages (plan_id, sender_id, message_type, content, metadata)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [planId, req.userId, message_type, content, metadata]);

  res.status(201).json(result.rows[0]);
}));

// Get date suggestions
router.get('/suggestions', asyncHandler(async (req: AuthRequest, res) => {
  const { category, limit = '20' } = req.query;

  let query = `
    SELECT * FROM date_suggestions
    WHERE is_active = true
  `;

  const params: any[] = [];

  if (category) {
    query += ` AND category = $1`;
    params.push(category);
  }

  query += `
    ORDER BY popularity_score DESC
    LIMIT $${params.length + 1}
  `;
  params.push(parseInt(limit as string));

  const result = await pool.query(query, params);

  res.json(result.rows);
}));

// Get specific date suggestion with details
router.get('/suggestions/:suggestionId', asyncHandler(async (req: AuthRequest, res) => {
  const { suggestionId } = req.params;

  const result = await pool.query(`
    SELECT
      ds.*,
      ml.title as venue_title,
      ml.description as venue_description,
      ml.images as venue_images,
      ml.price as venue_price,
      ml.address as venue_address
    FROM date_suggestions ds
    LEFT JOIN marketplace_listings ml ON ml.id = ds.venue_id
    WHERE ds.suggestion_id = $1 AND ds.is_active = true
  `, [suggestionId]);

  if (result.rows.length === 0) {
    throw new AppError('Date suggestion not found', 404);
  }

  res.json(result.rows[0]);
}));

// Get availability slots
router.get('/availability', asyncHandler(async (req: AuthRequest, res) => {
  const { start_date, end_date } = req.query;

  let query = 'SELECT * FROM availability_slots WHERE user_id = $1 AND is_active = true';
  const params: any[] = [req.userId];

  if (start_date) {
    params.push(start_date);
    query += ` AND end_time >= $${params.length}`;
  }

  if (end_date) {
    params.push(end_date);
    query += ` AND start_time <= $${params.length}`;
  }

  query += ' ORDER BY start_time ASC';

  const result = await pool.query(query, params);

  res.json(result.rows);
}));

// Create availability slot
router.post('/availability', asyncHandler(async (req: AuthRequest, res) => {
  const {
    slot_type = 'available',
    start_time,
    end_time,
    is_recurring,
    recurrence_rule,
    recurrence_exceptions,
    priority = 5,
    notes
  } = req.body;

  if (!start_time || !end_time) {
    throw new AppError('Start time and end time are required', 400);
  }

  const result = await pool.query(`
    INSERT INTO availability_slots (
      user_id, slot_type, start_time, end_time, is_recurring,
      recurrence_rule, recurrence_exceptions, priority, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    req.userId,
    slot_type,
    start_time,
    end_time,
    is_recurring || false,
    recurrence_rule,
    recurrence_exceptions,
    priority,
    notes
  ]);

  res.status(201).json(result.rows[0]);
}));

// Update availability slot
router.put('/availability/:slotId', asyncHandler(async (req: AuthRequest, res) => {
  const { slotId } = req.params;

  const {
    slot_type,
    start_time,
    end_time,
    is_recurring,
    recurrence_rule,
    recurrence_exceptions,
    priority,
    notes,
    is_active
  } = req.body;

  const result = await pool.query(`
    UPDATE availability_slots
    SET
      slot_type = COALESCE($1, slot_type),
      start_time = COALESCE($2, start_time),
      end_time = COALESCE($3, end_time),
      is_recurring = COALESCE($4, is_recurring),
      recurrence_rule = COALESCE($5, recurrence_rule),
      recurrence_exceptions = COALESCE($6, recurrence_exceptions),
      priority = COALESCE($7, priority),
      notes = COALESCE($8, notes),
      is_active = COALESCE($9, is_active),
      updated_at = NOW()
    WHERE id = $10 AND user_id = $11
    RETURNING *
  `, [
    slot_type,
    start_time,
    end_time,
    is_recurring,
    recurrence_rule,
    recurrence_exceptions,
    priority,
    notes,
    is_active,
    slotId,
    req.userId
  ]);

  if (result.rows.length === 0) {
    throw new AppError('Availability slot not found', 404);
  }

  res.json(result.rows[0]);
}));

// Delete availability slot
router.delete('/availability/:slotId', asyncHandler(async (req: AuthRequest, res) => {
  const { slotId } = req.params;

  await pool.query(
    'DELETE FROM availability_slots WHERE id = $1 AND user_id = $2',
    [slotId, req.userId]
  );

  res.json({ success: true });
}));

// Get mutual availability with another user
router.get('/availability/:userId/mutual', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { days_ahead = '14' } = req.query;

  // Check if cache exists and is recent (less than 1 hour old)
  const cacheResult = await pool.query(`
    SELECT * FROM mutual_availability_cache
    WHERE user1_id = LEAST($1, $2) AND user2_id = GREATEST($1, $2)
      AND last_computed_at > NOW() - INTERVAL '1 hour'
  `, [req.userId, parseInt(userId)]);

  if (cacheResult.rows.length > 0) {
    return res.json({
      available_slots: cacheResult.rows[0].available_slots,
      cached: true
    });
  }

  // Calculate mutual availability
  const result = await pool.query(`
    SELECT
      greatest(s1.start_time, s2.start_time) as start,
      least(s1.end_time, s2.end_time) as end,
      (s1.priority + s2.priority)::FLOAT / 2 as priority
    FROM availability_slots s1
    JOIN availability_slots s2 ON (
      s1.start_time < s2.end_time AND
      s1.end_time > s2.start_time AND
      s1.slot_type = 'available' AND
      s2.slot_type = 'available' AND
      s1.is_active = true AND
      s2.is_active = true
    )
    WHERE s1.user_id = $1 AND s2.user_id = $2
      AND s1.start_time > NOW()
      AND s1.start_time < NOW() + INTERVAL '${days_ahead} days'
    ORDER BY start ASC
    LIMIT 50
  `, [req.userId, parseInt(userId)]);

  const slots = result.rows;

  // Cache the result
  await pool.query(`
    INSERT INTO mutual_availability_cache (user1_id, user2_id, available_slots, last_computed_at)
    VALUES (LEAST($1, $2), GREATEST($1, $2), $3, NOW())
    ON CONFLICT (user1_id, user2_id)
    DO UPDATE SET
      available_slots = EXCLUDED.available_slots,
      last_computed_at = NOW()
  `, [req.userId, parseInt(userId), JSON.stringify(slots)]);

  res.json({
    available_slots: slots,
    cached: false
  });
}));

// Connect calendar
router.post('/calendar/connect', asyncHandler(async (req: AuthRequest, res) => {
  const { provider, access_token, refresh_token, calendar_id, calendar_name } = req.body;

  if (!['google', 'apple', 'outlook'].includes(provider)) {
    throw new AppError('Invalid calendar provider', 400);
  }

  // TODO: Implement actual OAuth flow with calendar providers
  // For now, store the tokens
  const tokenExpiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

  const result = await pool.query(`
    INSERT INTO calendar_connections (
      user_id, provider, access_token, refresh_token,
      token_expires_at, calendar_id, calendar_name
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id, provider)
    DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expires_at = EXCLUDED.token_expires_at,
      calendar_id = EXCLUDED.calendar_id,
      calendar_name = EXCLUDED.calendar_name,
      is_active = true,
      updated_at = NOW()
    RETURNING *
  `, [
    req.userId,
    provider,
    access_token,
    refresh_token,
    tokenExpiresAt,
    calendar_id,
    calendar_name
  ]);

  res.json(result.rows[0]);
}));

// Get calendar connections
router.get('/calendar/connections', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    'SELECT * FROM calendar_connections WHERE user_id = $1 AND is_active = true',
    [req.userId]
  );

  res.json(result.rows);
}));

// Submit date feedback
router.post('/plans/:planId/feedback', asyncHandler(async (req: AuthRequest, res) => {
  const { planId } = req.params;

  const {
    overall_rating,
    location_rating,
    conversation_rating,
    chemistry_rating,
    would_date_again,
    would_recommend_location,
    feedback_text,
    went_well,
    could_improve,
    actual_cost,
    actual_duration_minutes
  } = req.body;

  const result = await pool.query(`
    INSERT INTO date_feedback (
      plan_id, user_id, overall_rating, location_rating, conversation_rating,
      chemistry_rating, would_date_again, would_recommend_location,
      feedback_text, went_well, could_improve, actual_cost, actual_duration_minutes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (plan_id, user_id)
    DO UPDATE SET
      overall_rating = EXCLUDED.overall_rating,
      location_rating = EXCLUDED.location_rating,
      conversation_rating = EXCLUDED.conversation_rating,
      chemistry_rating = EXCLUDED.chemistry_rating,
      would_date_again = EXCLUDED.would_date_again,
      would_recommend_location = EXCLUDED.would_recommend_location,
      feedback_text = EXCLUDED.feedback_text,
      went_well = EXCLUDED.went_well,
      could_improve = EXCLUDED.could_improve,
      actual_cost = EXCLUDED.actual_cost,
      actual_duration_minutes = EXCLUDED.actual_duration_minutes
    RETURNING *
  `, [
    planId,
    req.userId,
    overall_rating,
    location_rating,
    conversation_rating,
    chemistry_rating,
    would_date_again,
    would_recommend_location,
    feedback_text,
    went_well,
    could_improve,
    actual_cost,
    actual_duration_minutes
  ]);

  // Update date planner stats with average rating
  if (overall_rating) {
    await pool.query(`
      UPDATE date_planner_stats
      SET average_date_rating = COALESCE(
        (SELECT AVG(overall_rating)::DECIMAL(3,2)
         FROM date_feedback
         WHERE user_id = $1),
        date_planner_stats.average_date_rating
      )
      WHERE user_id = $1
    `, [req.userId]);
  }

  res.status(201).json(result.rows[0]);
}));

// Get date planner stats
router.get('/stats', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    'SELECT * FROM date_planner_stats WHERE user_id = $1',
    [req.userId]
  );

  if (result.rows.length === 0) {
    // Create default stats
    await pool.query(`
      INSERT INTO date_planner_stats (user_id)
      VALUES ($1)
    `, [req.userId]);

    const newStats = await pool.query(
      'SELECT * FROM date_planner_stats WHERE user_id = $1',
      [req.userId]
    );

    return res.json(newStats.rows[0]);
  }

  res.json(result.rows[0]);
}));

export default router;
