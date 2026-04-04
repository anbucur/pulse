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

// Calculate and get current completion percentage for user
router.get('/calculate', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT p.*, u.email_verified, u.phone_verified, u.photo_verified,
      (SELECT COUNT(*) FROM user_photos WHERE user_id = p.user_id) as photo_count,
      (SELECT COUNT(*) FROM user_interests WHERE user_id = p.user_id) as interest_count,
      EXISTS(SELECT 1 FROM voice_profiles WHERE user_id = p.user_id) as has_voice_profile,
      EXISTS(SELECT 1 FROM kink_profiles WHERE user_id = p.user_id) as has_kink_profile
     FROM profiles p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = $1`,
    [req.userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Profile not found', 404);
  }

  const profile = result.rows[0];
  const missingFields: string[] = [];
  const filledFields: string[] = [];
  let completionPercent = 0;
  const weights: Record<string, number> = {
    photos: 25,
    bio: 15,
    location: 10,
    gender: 5,
    age: 5,
    interests: 15,
    email_verified: 10,
    phone_verified: 5,
    photo_verified: 5,
    voice_profile: 5,
    kink_profile: 5
  };

  // Check photos
  if (profile.photo_count > 0) {
    completionPercent += weights.photos;
    filledFields.push('photos');
  } else {
    missingFields.push('photos');
  }

  // Check bio
  if (profile.bio && profile.bio.length > 0) {
    completionPercent += weights.bio;
    filledFields.push('bio');
  } else {
    missingFields.push('bio');
  }

  // Check location
  if (profile.location && profile.location.length > 0) {
    completionPercent += weights.location;
    filledFields.push('location');
  } else {
    missingFields.push('location');
  }

  // Check gender
  if (profile.gender && profile.gender.length > 0) {
    completionPercent += weights.gender;
    filledFields.push('gender');
  } else {
    missingFields.push('gender');
  }

  // Check age
  if (profile.age && profile.age > 0) {
    completionPercent += weights.age;
    filledFields.push('age');
  } else {
    missingFields.push('age');
  }

  // Check interests
  if (profile.interest_count >= 3) {
    completionPercent += weights.interests;
    filledFields.push('interests');
  } else {
    missingFields.push('interests');
  }

  // Check email verification
  if (profile.email_verified) {
    completionPercent += weights.email_verified;
    filledFields.push('email_verified');
  } else {
    missingFields.push('email_verified');
  }

  // Check phone verification
  if (profile.phone_verified) {
    completionPercent += weights.phone_verified;
    filledFields.push('phone_verified');
  } else {
    missingFields.push('phone_verified');
  }

  // Check photo verification
  if (profile.photo_verified) {
    completionPercent += weights.photo_verified;
    filledFields.push('photo_verified');
  } else {
    missingFields.push('photo_verified');
  }

  // Check voice profile
  if (profile.has_voice_profile) {
    completionPercent += weights.voice_profile;
    filledFields.push('voice_profile');
  } else {
    missingFields.push('voice_profile');
  }

  // Check kink profile
  if (profile.has_kink_profile) {
    completionPercent += weights.kink_profile;
    filledFields.push('kink_profile');
  } else {
    missingFields.push('kink_profile');
  }

  // Save snapshot
  await pool.query(
    `INSERT INTO completion_snapshots
     (user_id, completion_percent, filled_fields, missing_fields, photo_count,
      has_bio, has_interests, has_location, verification_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      req.userId,
      completionPercent,
      filledFields,
      missingFields,
      profile.photo_count,
      !!(profile.bio && profile.bio.length > 0),
      profile.interest_count >= 3,
      !!(profile.location && profile.location.length > 0),
      profile.photo_verified ? 'photo' : (profile.phone_verified ? 'phone' : (profile.email_verified ? 'email' : 'none'))
    ]
  );

  // Update streak
  await pool.query(
    `INSERT INTO completion_streaks (user_id, current_streak_days, last_completion_update_at)
     VALUES ($1, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id)
     DO UPDATE SET
       current_streak_days = CASE
         WHEN completion_streaks.last_completion_update_at < CURRENT_DATE THEN completion_streaks.current_streak_days + 1
         ELSE completion_streaks.current_streak_days
       END,
       longest_streak_days = GREATEST(completion_streaks.longest_streak_days,
         CASE
           WHEN completion_streaks.last_completion_update_at < CURRENT_DATE THEN completion_streaks.current_streak_days + 1
           ELSE completion_streaks.current_streak_days
         END),
       last_completion_update_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`,
    [req.userId]
  );

  res.json({
    completion_percent: completionPercent,
    filled_fields: filledFields,
    missing_fields: missingFields,
    next_milestone: await getNextMilestone(completionPercent)
  });
}));

// Get available milestones
router.get('/milestones', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT pm.*, COALESCE(
        jsonb_build_object(
          'achieved_at', um.achieved_at,
          'reward_claimed', um.reward_claimed,
          'reward_claimed_at', um.reward_claimed_at,
          'reward_expires_at', um.reward_expires_at,
          'progress_data', um.progress_data
        ), '{}'::jsonb
      ) as user_progress
     FROM profile_milestones pm
     LEFT JOIN user_milestones um ON um.milestone_id = pm.id AND um.user_id = $1
     WHERE pm.is_active = true
     ORDER BY pm.required_completion_percent ASC, pm.sort_order ASC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Get user's achieved milestones
router.get('/milestones/achieved', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT um.*, pm.milestone_key, pm.milestone_name, pm.description,
        pm.reward_type, pm.reward_value, pm.icon, pm.badge_url
     FROM user_milestones um
     JOIN profile_milestones pm ON pm.id = um.milestone_id
     WHERE um.user_id = $1 AND um.achieved_at IS NOT NULL
     ORDER BY um.achieved_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Check and award milestones
router.post('/check-milestones', asyncHandler(async (req: AuthRequest, res) => {
  const completionResult = await pool.query(
    'SELECT completion_percent FROM completion_snapshots WHERE user_id = $1 ORDER BY calculated_at DESC LIMIT 1',
    [req.userId]
  );

  if (completionResult.rows.length === 0) {
    throw new AppError('No completion data found. Run /calculate first.', 400);
  }

  const completionPercent = completionResult.rows[0].completion_percent;

  // Find milestones that should be achieved
  const milestonesResult = await pool.query(
    `SELECT pm.*, um.id as user_milestone_id, um.achieved_at
     FROM profile_milestones pm
     LEFT JOIN user_milestones um ON um.milestone_id = pm.id AND um.user_id = $1
     WHERE pm.is_active = true
       AND pm.required_completion_percent <= $2
       AND um.id IS NULL`,
    [req.userId, completionPercent]
  );

  const newlyAchieved: any[] = [];

  for (const milestone of milestonesResult.rows) {
    const userMilestone = await pool.query(
      `INSERT INTO user_milestones (user_id, milestone_id, achieved_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       RETURNING *`,
      [req.userId, milestone.id]
    );

    newlyAchieved.push({
      ...milestone,
      user_milestone_id: userMilestone.rows[0].id,
      achieved_at: userMilestone.rows[0].achieved_at
    });
  }

  res.json({
    newly_achieved: newlyAchieved,
    total_achieved: newlyAchieved.length
  });
}));

// Claim a milestone reward
router.post('/milestones/:milestoneId/claim', asyncHandler(async (req: AuthRequest, res) => {
  const { milestoneId } = req.params;

  // Get milestone
  const milestoneResult = await pool.query(
    'SELECT * FROM profile_milestones WHERE id = $1',
    [milestoneId]
  );

  if (milestoneResult.rows.length === 0) {
    throw new AppError('Milestone not found', 404);
  }

  const milestone = milestoneResult.rows[0];

  // Get or create user milestone
  const userMilestoneResult = await pool.query(
    `SELECT * FROM user_milestones
     WHERE user_id = $1 AND milestone_id = $2`,
    [req.userId, milestoneId]
  );

  if (userMilestoneResult.rows.length === 0) {
    throw new AppError('Milestone not achieved yet', 400);
  }

  const userMilestone = userMilestoneResult.rows[0];

  if (!userMilestone.achieved_at) {
    throw new AppError('Milestone not achieved yet', 400);
  }

  if (userMilestone.reward_claimed) {
    throw new AppError('Reward already claimed', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const expiresAt = milestone.reward_duration_hours
      ? new Date(Date.now() + milestone.reward_duration_hours * 60 * 60 * 1000)
      : null;

    // Create reward
    await client.query(
      `INSERT INTO completion_rewards
       (user_id, milestone_id, reward_type, reward_value, reward_status, expires_at)
       VALUES ($1, $2, $3, $4, 'active', $5)`,
      [req.userId, milestoneId, milestone.reward_type, milestone.reward_value, expiresAt]
    );

    // Update user milestone
    await client.query(
      `UPDATE user_milestones
       SET reward_claimed = true,
           reward_claimed_at = CURRENT_TIMESTAMP,
           reward_expires_at = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [expiresAt, userMilestone.id]
    );

    // Track daily reward
    await client.query(
      `INSERT INTO daily_reward_tracking (user_id, reward_date, rewards_claimed, completion_percent_at_claim)
       VALUES ($1, CURRENT_DATE, 1,
         (SELECT completion_percent FROM completion_snapshots
          WHERE user_id = $1 ORDER BY calculated_at DESC LIMIT 1))
       ON CONFLICT (user_id, reward_date)
       DO UPDATE SET
         rewards_claimed = daily_reward_tracking.rewards_claimed + 1,
         updated_at = CURRENT_TIMESTAMP`,
      [req.userId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      reward_type: milestone.reward_type,
      reward_value: milestone.reward_value,
      expires_at: expiresAt
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Get active rewards
router.get('/rewards/active', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT cr.*, pm.milestone_name, pm.icon
     FROM completion_rewards cr
     LEFT JOIN profile_milestones pm ON pm.id = cr.milestone_id
     WHERE cr.user_id = $1
       AND cr.reward_status = 'active'
       AND (cr.expires_at IS NULL OR cr.expires_at > CURRENT_TIMESTAMP)
     ORDER BY cr.granted_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Get completion history
router.get('/history', asyncHandler(async (req: AuthRequest, res) => {
  const { limit = '30', days = '30' } = req.query;

  const result = await pool.query(
    `SELECT *
     FROM completion_snapshots
     WHERE user_id = $1
       AND calculated_at > CURRENT_TIMESTAMP - INTERVAL '${days} days'
     ORDER BY calculated_at DESC
     LIMIT $2`,
    [req.userId, limit]
  );

  res.json(result.rows);
}));

// Get streak info
router.get('/streak', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    'SELECT * FROM completion_streaks WHERE user_id = $1',
    [req.userId]
  );

  if (result.rows.length === 0) {
    return res.json({
      current_streak_days: 0,
      longest_streak_days: 0,
      milestones: { 7: false, 30: false, 100: false }
    });
  }

  const streak = result.rows[0];
  res.json({
    current_streak_days: streak.current_streak_days,
    longest_streak_days: streak.longest_streak_days,
    last_update: streak.last_completion_update_at,
    milestones: {
      7: streak.streak_milestone_7,
      30: streak.streak_milestone_30,
      100: streak.streak_milestone_100
    }
  });
}));

// Helper function to get next milestone
async function getNextMilestone(currentPercent: number) {
  const result = await pool.query(
    `SELECT *
     FROM profile_milestones
     WHERE is_active = true
       AND required_completion_percent > $1
     ORDER BY required_completion_percent ASC
     LIMIT 1`,
    [currentPercent]
  );

  return result.rows[0] || null;
}

export default router;
