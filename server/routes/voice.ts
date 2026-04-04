/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { pool, minioClient } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const router = Router();
router.use(authenticate);

// Get my voice profile
router.get('/me', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    'SELECT * FROM voice_profiles WHERE user_id = $1 AND is_active = true',
    [req.userId]
  );

  if (result.rows.length === 0) {
    return res.json({ has_recording: false });
  }

  res.json({
    has_recording: true,
    ...result.rows[0]
  });
}));

// Get voice profile by user ID (for playing)
router.get('/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;

  const result = await pool.query(
    'SELECT * FROM voice_profiles WHERE user_id = $1 AND is_active = true',
    [userId]
  );

  if (result.rows.length === 0) {
    return res.json({ has_recording: false });
  }

  const voiceProfile = result.rows[0];

  // Update play count
  await pool.query(
    `UPDATE voice_profiles
     SET play_count = play_count + 1,
         last_played_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [voiceProfile.id]
  );

  // Log the play
  await pool.query(
    `INSERT INTO voice_profile_plays (voice_profile_id, listener_id)
     VALUES ($1, $2)
     ON CONFLICT (voice_profile_id, listener_id)
     DO UPDATE SET played_at = CURRENT_TIMESTAMP`,
    [voiceProfile.id, req.userId]
  );

  res.json({
    has_recording: true,
    ...voiceProfile
  });
}));

// Upload voice recording
router.post('/upload', asyncHandler(async (req: AuthRequest, res) => {
  const { audio_data, duration } = req.body;

  if (!audio_data) {
    throw new AppError('Audio data required', 400);
  }

  if (!duration || duration < 1 || duration > 30) {
    throw new AppError('Duration must be between 1 and 30 seconds', 400);
  }

  // Convert base64 to buffer
  const base64Data = audio_data.replace(/^data:audio\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Generate unique filename
  const timestamp = Date.now();
  const filename = `voice-profiles/${req.userId}/${timestamp}.webm`;

  // Upload to MinIO
  const bucket = process.env.MINIO_BUCKET || 'pulse';
  await minioClient.putObject(bucket, filename, buffer, {
    'Content-Type': 'audio/webm',
    'X-Amz-Meta-UserId': req.userId.toString()
  });

  // Construct URL
  const audioUrl = `${process.env.MINIO_ENDPOINT || 'http://localhost:9000'}/${bucket}/${filename}`;

  // Update or create voice profile
  const result = await pool.query(
    `INSERT INTO voice_profiles (user_id, audio_url, duration, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (user_id)
     DO UPDATE SET
       audio_url = $2,
       duration = $3,
       is_active = true,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [req.userId, audioUrl, duration]
  );

  // Update profile completion
  await pool.query(
    `UPDATE profiles
     SET profile_completion = COALESCE(profile_completion, 0) + 5
     WHERE user_id = $1`,
    [req.userId]
  );

  res.json(result.rows[0]);
}));

// Delete voice profile
router.delete('/me', asyncHandler(async (req: AuthRequest, res) => {
  await pool.query(
    `UPDATE voice_profiles
     SET is_active = false,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1`,
    [req.userId]
  );

  // Update profile completion
  await pool.query(
    `UPDATE profiles
     SET profile_completion = GREATEST(0, COALESCE(profile_completion, 0) - 5)
     WHERE user_id = $1`,
    [req.userId]
  );

  res.json({ message: 'Voice profile deleted' });
}));

// Get reaction stats
router.get('/stats/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;

  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM voice_profile_plays WHERE voice_profile_id = vp.id) as total_plays,
       (SELECT COUNT(DISTINCT listener_id) FROM voice_profile_plays WHERE voice_profile_id = vp.id) as unique_listeners,
       vp.play_count,
       vp.recorded_at,
       vp.last_played_at
     FROM voice_profiles vp
     WHERE vp.user_id = $1 AND vp.is_active = true`,
    [userId]
  );

  if (result.rows.length === 0) {
    return res.json({ has_recording: false });
  }

  // Get reactions breakdown
  const reactions = await pool.query(
    `SELECT reaction_type, COUNT(*) as count
     FROM voice_profile_reactions vpr
     JOIN voice_profiles vp ON vp.id = vpr.voice_profile_id
     WHERE vp.user_id = $1 AND vp.is_active = true
     GROUP BY reaction_type`,
    [userId]
  );

  res.json({
    ...result.rows[0],
    reactions: reactions.rows
  });
}));

// React to a voice profile
router.post('/react/:voiceProfileId', asyncHandler(async (req: AuthRequest, res) => {
  const { voiceProfileId } = req.params;
  const { reaction_type } = req.body;

  if (!['heart', 'fire', 'laugh', 'thoughtful'].includes(reaction_type)) {
    throw new AppError('Invalid reaction type', 400);
  }

  await pool.query(
    `INSERT INTO voice_profile_reactions (voice_profile_id, reactor_id, reaction_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (voice_profile_id, reactor_id, reaction_type)
     DO NOTHING`,
    [voiceProfileId, req.userId, reaction_type]
  );

  res.json({ message: 'Reaction recorded' });
}));

// Remove reaction
router.delete('/react/:voiceProfileId/:reactionType', asyncHandler(async (req: AuthRequest, res) => {
  const { voiceProfileId, reactionType } = req.params;

  await pool.query(
    `DELETE FROM voice_profile_reactions
     WHERE voice_profile_id = $1
       AND reactor_id = $2
       AND reaction_type = $3`,
    [voiceProfileId, req.userId, reactionType]
  );

  res.json({ message: 'Reaction removed' });
}));

export default router;
