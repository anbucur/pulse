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

// Get today's curated matches
router.get('/daily', asyncHandler(async (req: AuthRequest, res) => {
  const today = new Date().toISOString().split('T')[0];

  // Check if matches already exist for today
  const existing = await pool.query(
    `SELECT sdm.*, p.display_name, p.age, p.gender, p.photos, p.primary_photo_index,
            p.bio, p.interests, p.location, p.tags
     FROM slowdating_daily_matches sdm
     JOIN profiles p ON p.user_id = sdm.match_id
     WHERE sdm.user_id = $1 AND sdm.match_date = $2
     ORDER BY sdm.compatibility_score DESC`,
    [req.userId, today]
  );

  if (existing.rows.length > 0) {
    return res.json({
      matches: existing.rows,
      date: today,
      count: existing.rows.length
    });
  }

  // Generate new daily matches
  const generated = await generateDailyMatches(req.userId, today);
  res.json(generated);
}));

// Get user's slow dating preferences
router.get('/preferences', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    'SELECT * FROM slowdating_preferences WHERE user_id = $1',
    [req.userId]
  );

  if (result.rows.length === 0) {
    // Create default preferences
    const defaults = await pool.query(
      `INSERT INTO slowdating_preferences (user_id)
       VALUES ($1)
       RETURNING *`,
      [req.userId]
    );
    return res.json(defaults.rows[0]);
  }

  res.json(result.rows[0]);
}));

// Update preferences
router.put('/preferences', asyncHandler(async (req: AuthRequest, res) => {
  const {
    daily_match_count,
    min_compatibility_score,
    preferred_age_range,
    preferred_genders,
    preferred_orientations,
    focus_areas,
    wants_kids,
    relationship_goals
  } = req.body;

  const result = await pool.query(
    `UPDATE slowdating_preferences
     SET daily_match_count = COALESCE($2, daily_match_count),
         min_compatibility_score = COALESCE($3, min_compatibility_score),
         preferred_age_range = COALESCE($4, preferred_age_range),
         preferred_genders = COALESCE($5, preferred_genders),
         preferred_orientations = COALESCE($6, preferred_orientations),
         focus_areas = COALESCE($7, focus_areas),
         wants_kids = COALESCE($8, wants_kids),
         relationship_goals = COALESCE($9, relationship_goals),
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1
     RETURNING *`,
    [
      req.userId,
      daily_match_count,
      min_compatibility_score,
      preferred_age_range ? JSON.stringify(preferred_age_range) : null,
      preferred_genders,
      preferred_orientations,
      focus_areas,
      wants_kids,
      relationship_goals
    ]
  );

  res.json(result.rows[0]);
}));

// Respond to a match (pass/like/skip)
router.post('/respond/:matchId', asyncHandler(async (req: AuthRequest, res) => {
  const { matchId } = req.params;
  const { response_type, notes } = req.body;

  if (!['pass', 'like', 'skip'].includes(response_type)) {
    throw new AppError('Invalid response type', 400);
  }

  // Record response
  const result = await pool.query(
    `INSERT INTO slowdating_responses (user_id, match_id, response_type, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, match_id)
     DO UPDATE SET response_type = $3, notes = $4, responded_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [req.userId, matchId, response_type, notes || null]
  );

  // Check for mutual like
  if (response_type === 'like') {
    const mutual = await pool.query(
      `SELECT * FROM slowdating_responses
       WHERE user_id = $1 AND match_id = $2 AND response_type = 'like'`,
      [matchId, req.userId]
    );

    if (mutual.rows.length > 0) {
      // Create a match
      await pool.query(
        `INSERT INTO matches (user1_id, user2_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.userId, matchId]
      );

      return res.json({
        response: result.rows[0],
        mutual_match: true
      });
    }
  }

  res.json({ response: result.rows[0], mutual_match: false });
}));

// Get match history
router.get('/history', asyncHandler(async (req: AuthRequest, res) => {
  const { limit = 30, offset = 0 } = req.query;

  const result = await pool.query(
    `SELECT * FROM slowdating_match_history
     WHERE user_id = $1
     ORDER BY match_date DESC
     LIMIT $2 OFFSET $3`,
    [req.userId, limit, offset]
  );

  res.json({
    history: result.rows,
    total: result.rows.length,
    offset: parseInt(offset as string),
    limit: parseInt(limit as string)
  });
}));

// Get past responses
router.get('/responses', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT sr.*, p.display_name, p.age, p.gender, p.photos, p.primary_photo_index
     FROM slowdating_responses sr
     JOIN profiles p ON p.user_id = sr.match_id
     WHERE sr.user_id = $1
     ORDER BY sr.responded_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Helper function to generate daily matches
async function generateDailyMatches(userId: number, date: string) {
  // Get user preferences
  const prefsResult = await pool.query(
    'SELECT * FROM slowdating_preferences WHERE user_id = $1',
    [userId]
  );

  const prefs = prefsResult.rows[0] || {
    daily_match_count: 3,
    min_compatibility_score: 70,
    preferred_age_range: { min: 21, max: 100 },
    preferred_genders: [],
    preferred_orientations: [],
    focus_areas: ['values', 'interests']
  };

  // Get user's profile
  const userProfile = await pool.query(
    'SELECT * FROM profiles WHERE user_id = $1',
    [userId]
  );

  if (userProfile.rows.length === 0) {
    throw new AppError('Profile not found', 404);
  }

  const profile = userProfile.rows[0];

  // Find potential matches
  let matchQuery = `
    SELECT p.*, u.id as user_id, u.is_premium
    FROM profiles p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id != $1
      AND p.user_id NOT IN (
        SELECT match_id FROM slowdating_responses
        WHERE user_id = $1 AND response_type IN ('pass', 'skip')
      )
      AND p.user_id NOT IN (
        SELECT match_id FROM slowdating_daily_matches
        WHERE user_id = $1 AND match_date = $2
      )
  `;

  const queryParams: any[] = [userId, date];
  let paramIndex = 3;

  // Apply age filter
  if (prefs.preferred_age_range) {
    matchQuery += ` AND p.age >= $${paramIndex++} AND p.age <= $${paramIndex++}`;
    queryParams.push(prefs.preferred_age_range.min, prefs.preferred_age_range.max);
  }

  // Apply gender filter
  if (prefs.preferred_genders && prefs.preferred_genders.length > 0) {
    matchQuery += ` AND p.gender = ANY($${paramIndex++})`;
    queryParams.push(prefs.preferred_genders);
  }

  // Apply orientation filter
  if (prefs.preferred_orientations && prefs.preferred_orientations.length > 0) {
    matchQuery += ` AND p.sexual_orientation && $${paramIndex++}`;
    queryParams.push(prefs.preferred_orientations);
  }

  matchQuery += ` ORDER BY RANDOM() LIMIT 50`;

  const potentialMatches = await pool.query(matchQuery, queryParams);

  // Calculate compatibility and rank
  const scoredMatches = potentialMatches.rows.map(candidate => {
    const score = calculateCompatibility(profile, candidate, prefs.focus_areas || []);
    return {
      ...candidate,
      compatibility_score: score.score,
      compatibility_reason: score.reason,
      shared_interests: score.shared_interests,
      conversation_starters: generateConversationStarters(profile, candidate, score.shared_interests)
    };
  });

  // Filter by minimum score and sort
  const qualifiedMatches = scoredMatches
    .filter(m => m.compatibility_score >= prefs.min_compatibility_score)
    .sort((a, b) => b.compatibility_score - a.compatibility_score)
    .slice(0, prefs.daily_match_count);

  // Insert matches into database
  for (const match of qualifiedMatches) {
    await pool.query(
      `INSERT INTO slowdating_daily_matches
       (user_id, match_id, match_date, compatibility_score, conversation_starters,
        compatibility_reason, shared_interests, shared_values)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        match.user_id,
        date,
        match.compatibility_score,
        match.conversation_starters,
        match.compatibility_reason,
        match.shared_interests,
        [] // shared_values - could be calculated from compatibility matrix
      ]
    );
  }

  // Update match history
  await pool.query(
    `INSERT INTO slowdating_match_history (user_id, match_date, matches_received)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, match_date)
     DO UPDATE SET matches_received = $3`,
    [userId, date, qualifiedMatches.length]
  );

  return {
    matches: qualifiedMatches,
    date: date,
    count: qualifiedMatches.length
  };
}

function calculateCompatibility(
  profile: any,
  candidate: any,
  focusAreas: string[]
): { score: number; reason: string; shared_interests: string[] } {
  let score = 50; // Base score
  const reasons: string[] = [];
  const sharedInterests: string[] = [];

  // Interest compatibility
  if (profile.interests && candidate.interests) {
    const profileInterests = profile.interests || [];
    const candidateInterests = candidate.interests || [];
    const common = profileInterests.filter((i: string) => candidateInterests.includes(i));
    sharedInterests.push(...common);

    if (common.length > 0) {
      const interestScore = Math.min(30, common.length * 10);
      score += interestScore;
      reasons.push(`${common.length} shared interests`);
    }
  }

  // Age compatibility
  if (profile.age && candidate.age) {
    const ageDiff = Math.abs(profile.age - candidate.age);
    if (ageDiff <= 5) {
      score += 10;
      reasons.push('close in age');
    } else if (ageDiff <= 10) {
      score += 5;
    }
  }

  // Location compatibility
  if (profile.location && candidate.location && profile.location === candidate.location) {
    score += 10;
    reasons.push('same location');
  }

  // Intent compatibility
  if (profile.intent && candidate.intent) {
    const commonIntents = profile.intent.filter((i: string) => candidate.intent.includes(i));
    if (commonIntents.length > 0) {
      score += commonIntents.length * 5;
      reasons.push(`${commonIntents.length} shared relationship goals`);
    }
  }

  // Tag compatibility
  if (profile.tags && candidate.tags) {
    const commonTags = profile.tags.filter((t: string) => candidate.tags.includes(t));
    if (commonTags.length > 0) {
      score += Math.min(10, commonTags.length * 2);
      reasons.push('vibe match');
    }
  }

  // Bonus for verified users
  if (candidate.is_verified) {
    score += 5;
    reasons.push('verified profile');
  }

  return {
    score: Math.min(100, score),
    reason: reasons.length > 0 ? reasons.join(', ') : 'potential connection',
    shared_interests: [...new Set(sharedInterests)]
  };
}

function generateConversationStarters(
  profile: any,
  candidate: any,
  sharedInterests: string[]
): string[] {
  const starters: string[] = [];

  if (sharedInterests.length > 0) {
    starters.push(`I see you're also into ${sharedInterests[0]}! What got you into that?`);
  }

  if (candidate.bio) {
    starters.push(`Your bio caught my attention - tell me more about yourself`);
  }

  if (profile.interests && candidate.interests) {
    const candidateUnique = candidate.interests.filter(
      (i: string) => !profile.interests.includes(i)
    );
    if (candidateUnique.length > 0) {
      starters.push(`I noticed you're into ${candidateUnique[0]} - I've been curious about that`);
    }
  }

  starters.push('Hey! I thought we might vibe based on our compatibility score');

  return starters.slice(0, 3);
}

export default router;
