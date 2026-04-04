/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { pool } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();
router.use(authenticate);

// Placeholder comparison function - In production, use actual face matching API
function comparePhotos(livePhotoHash: string, profilePhotoHash: string): number {
  // Simple hash comparison for now
  // In production, this would call a face matching service
  const hash1 = Buffer.from(livePhotoHash, 'hex');
  const hash2 = Buffer.from(profilePhotoHash, 'hex');

  if (hash1.length !== hash2.length) return 0;

  let matchingBytes = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) matchingBytes++;
  }

  return (matchingBytes / hash1.length) * 100;
}

// Generate a simple hash from a base64 image
function generateImageHash(base64Image: string): string {
  // Remove data URL prefix if present
  const base64Data = base64Image.split(',')[1] || base64Image;
  return crypto.createHash('sha256').update(base64Data).digest('hex');
}

// Get verification status for current user
router.get('/status', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT pv.*, vb.badge_type, vb.verification_count, vb.consecutive_verifications,
            vb.display_on_profile, vb.last_verified_at
     FROM photo_verifications pv
     LEFT JOIN verification_badges vb ON vb.user_id = pv.user_id
     WHERE pv.user_id = $1
     ORDER BY pv.created_at DESC
     LIMIT 1`,
    [req.userId]
  );

  if (result.rows.length === 0) {
    return res.json({
      verified: false,
      hasBadge: false,
      status: 'none'
    });
  }

  const verification = result.rows[0];
  res.json({
    verified: verification.status === 'verified',
    status: verification.status,
    badgeType: verification.badge_type,
    verificationCount: verification.verification_count || 0,
    consecutiveVerifications: verification.consecutive_verifications || 0,
    displayOnProfile: verification.display_on_profile,
    lastVerifiedAt: verification.verified_at,
    expiresAt: verification.expires_at,
    attemptCount: verification.attempt_count
  });
}));

// Submit photo verification
router.post('/submit', asyncHandler(async (req: AuthRequest, res) => {
  const { live_photo, profile_photo_id } = req.body;

  if (!live_photo) {
    throw new AppError('live_photo is required', 400);
  }

  // Get user's profile photo if not provided
  let profilePhotoData = live_photo; // Default to same photo for now
  if (profile_photo_id) {
    // In production, fetch from storage service
    const profileResult = await pool.query(
      'SELECT photos FROM profiles WHERE user_id = $1',
      [req.userId]
    );
    if (profileResult.rows.length > 0) {
      // profilePhotoData would be fetched from storage
    }
  }

  const livePhotoHash = generateImageHash(live_photo);
  const profilePhotoHash = generateImageHash(profilePhotoData);

  // Compare photos (placeholder logic)
  const comparisonScore = comparePhotos(livePhotoHash, profilePhotoHash);

  const threshold = 70; // 70% similarity threshold
  const status = comparisonScore >= threshold ? 'verified' : 'rejected';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check previous attempts
    const recentAttempts = await client.query(
      `SELECT COUNT(*) as count, attempt_count
       FROM photo_verifications
       WHERE user_id = $1
       AND created_at > NOW() - INTERVAL '24 hours'
       AND status != 'expired'`,
      [req.userId]
    );

    const attemptCount = (recentAttempts.rows[0]?.count || 0) + 1;

    if (attemptCount > 5) {
      throw new AppError('Too many verification attempts. Please try again tomorrow.', 429);
    }

    // Create verification record
    const verificationResult = await client.query(
      `INSERT INTO photo_verifications
       (user_id, live_photo_url, profile_photo_id, comparison_score, status,
        attempt_count, ip_address, user_agent${status === 'verified' ? ', verified_at' : ''})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8${status === 'verified' ? ', NOW()' : ''})
       RETURNING *`,
      [
        req.userId,
        'stored_in_storage_service', // In production, upload to MinIO/S3
        profile_photo_id || null,
        comparisonScore,
        status,
        attemptCount,
        req.ip,
        req.get('user-agent') || null
      ]
    );

    const verification = verificationResult.rows[0];

    // Log to audit
    await client.query(
      `INSERT INTO verification_audit_log
       (user_id, verification_id, action, status_to, details, ip_address)
       VALUES ($1, $2, 'submit', $3, $4, $5)`,
      [
        req.userId,
        verification.id,
        status,
        JSON.stringify({ comparisonScore, attemptCount }),
        req.ip
      ]
    );

    if (status === 'verified') {
      // Update or create badge
      const badgeResult = await client.query(
        `INSERT INTO verification_badges
         (user_id, badge_type, display_on_profile, last_verified_at,
          verification_count, consecutive_verifications)
         VALUES ($1, $2, true, NOW(), 1,
           COALESCE((SELECT consecutive_verifications FROM verification_badges WHERE user_id = $1), 0) + 1)
         ON CONFLICT (user_id)
         DO UPDATE SET
           badge_type = CASE
             WHEN verification_badges.verification_count + 1 >= 10 THEN 'super_verified'
             WHEN verification_badges.verification_count + 1 >= 5 THEN 'verified_plus'
             ELSE 'verified'
           END,
           last_verified_at = NOW(),
           verification_count = verification_badges.verification_count + 1,
           consecutive_verifications = verification_badges.consecutive_verifications + 1,
           updated_at = NOW()
         RETURNING *`,
        [req.userId]
      );

      res.json({
        success: true,
        verified: true,
        verification,
        badge: badgeResult.rows[0]
      });
    } else {
      res.json({
        success: false,
        verified: false,
        verification,
        reason: comparisonScore < threshold
          ? 'Photo comparison did not meet verification threshold'
          : 'Verification failed'
      });
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Toggle badge visibility
router.patch('/badge/visibility', asyncHandler(async (req: AuthRequest, res) => {
  const { display_on_profile } = req.body;

  await pool.query(
    `INSERT INTO verification_badges (user_id, display_on_profile)
     VALUES ($1, $2)
     ON CONFLICT (user_id)
     DO UPDATE SET display_on_profile = $2, updated_at = NOW()`,
    [req.userId, display_on_profile !== undefined ? display_on_profile : true]
  );

  res.json({ success: true });
}));

// Get verification history
router.get('/history', asyncHandler(async (req: AuthRequest, res) => {
  const { limit = '10', offset = '0' } = req.query;

  const result = await pool.query(
    `SELECT * FROM photo_verifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.userId, limit, offset]
  );

  res.json(result.rows);
}));

// Get public badge info for a user
router.get('/badge/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;

  const result = await pool.query(
    `SELECT badge_type, verification_count, consecutive_verifications,
            last_verified_at, display_on_profile
     FROM verification_badges
     WHERE user_id = $1 AND display_on_profile = true`,
    [userId]
  );

  if (result.rows.length === 0) {
    return res.json({ hasBadge: false });
  }

  const badge = result.rows[0];

  // Check if badge is expired
  const isExpired = badge.last_verified_at
    ? new Date(badge.last_verified_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    : false;

  res.json({
    hasBadge: true,
    badgeType: badge.badge_type,
    verificationCount: badge.verification_count,
    consecutiveVerifications: badge.consecutive_verifications,
    lastVerifiedAt: badge.last_verified_at,
    isExpired
  });
}));

// Re-verify (update existing verification)
router.post('/reverify', asyncHandler(async (req: AuthRequest, res) => {
  const { live_photo } = req.body;

  if (!live_photo) {
    throw new AppError('live_photo is required', 400);
  }

  // Check if user has a previous verification
  const existingResult = await pool.query(
    `SELECT * FROM photo_verifications
     WHERE user_id = $1 AND status = 'verified'
     ORDER BY created_at DESC
     LIMIT 1`,
    [req.userId]
  );

  if (existingResult.rows.length === 0) {
    throw new AppError('No existing verification found', 404);
  }

  const existing = existingResult.rows[0];

  const livePhotoHash = generateImageHash(live_photo);
  const profilePhotoHash = generateImageHash(live_photo); // Compare with self for re-verification

  const comparisonScore = comparePhotos(livePhotoHash, profilePhotoHash);
  const status = comparisonScore >= 70 ? 'verified' : 'rejected';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const newVerificationResult = await client.query(
      `INSERT INTO photo_verifications
       (user_id, live_photo_url, profile_photo_id, comparison_score, status,
        attempt_count, verified_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, 1, NOW(), $6, $7)
       RETURNING *`,
      [
        req.userId,
        'stored_in_storage_service',
        existing.profile_photo_id,
        comparisonScore,
        status,
        req.ip,
        req.get('user-agent') || null
      ]
    );

    const newVerification = newVerificationResult.rows[0];

    if (status === 'verified') {
      await client.query(
        `UPDATE verification_badges
         SET last_verified_at = NOW(),
             verification_count = verification_count + 1,
             consecutive_verifications = consecutive_verifications + 1,
             badge_type = CASE
               WHEN verification_count + 1 >= 10 THEN 'super_verified'
               WHEN verification_count + 1 >= 5 THEN 'verified_plus'
               ELSE 'verified'
             END,
             updated_at = NOW()
         WHERE user_id = $1`,
        [req.userId]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: status === 'verified',
      verified: status === 'verified',
      verification: newVerification
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

export default router;
