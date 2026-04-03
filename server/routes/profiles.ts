import { Router } from 'express';
import { profileUpdateValidation, validate } from '../middleware/validate.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { pool } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// All profile routes require authentication
router.use(authenticate);

// Get my profile
router.get('/me', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    'SELECT * FROM profiles WHERE user_id = $1',
    [req.userId]
  );

  if (result.rows.length === 0) {
    // Create profile if it doesn't exist
    const newProfile = await pool.query(
      `INSERT INTO profiles (user_id)
       VALUES ($1)
       RETURNING *`,
      [req.userId]
    );
    return res.json(newProfile.rows[0]);
  }

  res.json(result.rows[0]);
});

// Get profile by ID (public view with privacy applied)
router.get('/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const viewerId = req.userId;

  // Check if blocked
  const blocked = await pool.query(
    `SELECT * FROM blocks
     WHERE blocker_id = $1 AND blocked_id = $2
        OR blocker_id = $2 AND blocked_id = $1`,
    [viewerId, userId]
  );

  if (blocked.rows.length > 0) {
    throw new AppError('Profile not available', 403);
  }

  const result = await pool.query(
    'SELECT * FROM profiles WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Profile not found', 404);
  }

  const profile = result.rows[0];

  // Apply privacy settings
  const privacy = profile.privacy_settings || {};

  // Log profile view
  if (viewerId !== userId) {
    await pool.query(
      `INSERT INTO profile_views (viewer_id, profile_id)
       VALUES ($1, $2)`,
      [viewerId, userId]
    );

    await pool.query(
      `UPDATE profiles SET profile_views = profile_views + 1 WHERE user_id = $1`,
      [userId]
    );
  }

  // Filter based on privacy settings
  const sanitizedProfile: any = {
    user_id: profile.user_id,
    display_name: privacy.displayName === 'private' ? null : profile.display_name,
    age: privacy.age === 'private' ? null : profile.age,
    gender: privacy.gender === 'private' ? null : profile.gender,
    bio: privacy.bio === 'private' ? null : profile.bio,
    photos: privacy.photos === 'private' ? [] : profile.photos,
    video_url: privacy.video_url === 'private' ? null : profile.video_url,
    primary_photo_index: profile.primary_photo_index,
    is_verified: profile.is_verified,
    is_ghost_mode: profile.is_ghost_mode,
    broadcast: profile.broadcast && profile.broadcast_expires_at > new Date() ? profile.broadcast : null,
    // Public fields
    interests: profile.interests,
    tags: profile.tags,
    intent: profile.intent,
    location: profile.location,
    lat: privacy.location === 'private' ? null : profile.lat,
    lng: privacy.location === 'private' ? null : profile.lng,
  };

  // Include sexual profile only if not private
  if (privacy.sexualProfile !== 'private') {
    sanitizedProfile.sexual_orientation = profile.sexual_orientation;
    sanitizedProfile.relationship_style = profile.relationship_style;
    sanitizedProfile.sexual_role = profile.sexual_role;
  }

  // Include kink profile only if not private
  if (privacy.kinkProfile !== 'private') {
    sanitizedProfile.kinks = profile.kinks;
    sanitizedProfile.kink_preferences = profile.kink_preferences;
  }

  res.json(sanitizedProfile);
}));

// Update my profile
router.put('/me', validate(profileUpdateValidation), asyncHandler(async (req: AuthRequest, res) => {
  const updates = req.body;
  const allowedFields = [
    'display_name', 'age', 'gender', 'pronouns', 'bio', 'location', 'lat', 'lng',
    'height', 'body_type', 'hair_color', 'eye_color', 'ethnicity',
    'sexual_orientation', 'relationship_status', 'relationship_style', 'sexual_role',
    'experience_level', 'std_friendly', 'vaccinated',
    'kinks', 'kink_preferences',
    'education', 'occupation', 'income_level', 'smoking_habit', 'drinking_habit',
    'exercise_habit', 'diet',
    'mbti', 'love_languages', 'attachment_style', 'communication_style',
    'interests', 'hobbies', 'tags',
    'intent', 'looking_for_age_range', 'looking_for_gender', 'looking_for_location_radius',
    'privacy_settings', 'primary_photo_index', 'video_url',
    'is_ghost_mode', 'incognito_mode', 'broadcast', 'broadcast_expires_at'
  ];

  const filteredUpdates: any = {};
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  });

  // Build dynamic query
  const setClause = Object.keys(filteredUpdates)
    .map((key, index) => `${key} = $${index + 2}`)
    .join(', ');

  const values = [req.userId, ...Object.values(filteredUpdates)];

  const result = await pool.query(
    `UPDATE profiles
     SET ${setClause}, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1
     RETURNING *`,
    values
  );

  res.json(result.rows[0]);
}));

// Upload photo
router.post('/photos', asyncHandler(async (req: AuthRequest, res) => {
  const { url } = req.body;

  if (!url) {
    throw new AppError('Photo URL required', 400);
  }

  const result = await pool.query(
    `UPDATE profiles
     SET photos = COALESCE(photos, '[]'::text[]) || $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $2
     RETURNING photos`,
    [[url], req.userId]
  );

  res.json({ photos: result.rows[0].photos });
}));

// Remove photo
router.delete('/photos/:index', asyncHandler(async (req: AuthRequest, res) => {
  const { index } = req.params;

  const result = await pool.query(
    `UPDATE profiles
     SET photos = array_remove(photos, photos[$2]),
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1
     RETURNING photos`,
    [req.userId, parseInt(index) + 1]
  );

  res.json({ photos: result.rows[0].photos });
}));

// Update privacy settings
router.put('/privacy', asyncHandler(async (req: AuthRequest, res) => {
  const { privacy_settings } = req.body;

  const result = await pool.query(
    `UPDATE profiles
     SET privacy_settings = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $2
     RETURNING privacy_settings`,
    [JSON.stringify(privacy_settings), req.userId]
  );

  res.json(result.rows[0]);
}));

// Search profiles
router.get('/search', asyncHandler(async (req: AuthRequest, res) => {
  const {
    age_min, age_max, gender, orientation, distance, interests,
    has_photo, is_verified, intent, offset = 0, limit = 20
  } = req.query;

  let query = `
    SELECT p.*, u.email, u.is_premium
    FROM profiles p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id != $1
  `;

  const params: any[] = [req.userId];
  let paramIndex = 2;

  if (age_min) {
    query += ` AND p.age >= $${paramIndex++}`;
    params.push(age_min);
  }
  if (age_max) {
    query += ` AND p.age <= $${paramIndex++}`;
    params.push(age_max);
  }
  if (gender) {
    query += ` AND p.gender = $${paramIndex++}`;
    params.push(gender);
  }
  if (orientation) {
    query += ` AND $${paramIndex++} = ANY(p.sexual_orientation)`;
    params.push(orientation);
  }
  if (intent) {
    query += ` AND $${paramIndex++} = ANY(p.intent)`;
    params.push(intent);
  }
  if (has_photo === 'true') {
    query += ` AND array_length(p.photos, 1) > 0`;
  }
  if (is_verified === 'true') {
    query += ` AND p.is_verified = true`;
  }

  query += ` ORDER BY p.updated_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(parseInt(limit as string), parseInt(offset as string));

  const result = await pool.query(query, params);

  res.json({
    profiles: result.rows,
    total: result.rows.length,
    offset: parseInt(offset as string),
    limit: parseInt(limit as string),
  });
}));

// Tap (like/wave) a user
router.post('/tap/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { type = 'like' } = req.body;

  if (userId === req.userId) {
    throw new AppError('Cannot tap yourself', 400);
  }

  // Check if already tapped
  const existing = await pool.query(
    'SELECT * FROM taps WHERE from_user_id = $1 AND to_user_id = $2',
    [req.userId, userId]
  );

  if (existing.rows.length > 0) {
    throw new AppError('Already tapped this user', 400);
  }

  // Create tap
  await pool.query(
    `INSERT INTO taps (from_user_id, to_user_id, tap_type)
     VALUES ($1, $2, $3)`,
    [req.userId, userId, type]
  );

  // Check for mutual tap (match)
  const mutualTap = await pool.query(
    'SELECT * FROM taps WHERE from_user_id = $1 AND to_user_id = $2',
    [userId, req.userId]
  );

  if (mutualTap.rows.length > 0) {
    // Create match
    await pool.query(
      `INSERT INTO matches (user1_id, user2_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.userId, userId]
    );

    return res.json({ match: true });
  }

  res.json({ match: false });
}));

// Block user
router.post('/block/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;

  await pool.query(
    `INSERT INTO blocks (blocker_id, blocked_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [req.userId, userId]
  );

  res.json({ message: 'User blocked' });
}));

// Get blocked users
router.get('/blocked', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT b.*, p.display_name, p.photos
     FROM blocks b
     JOIN profiles p ON p.user_id = b.blocked_id
     WHERE b.blocker_id = $1
     ORDER BY b.blocked_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

export default router;
