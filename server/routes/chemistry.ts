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

// Calculate compatibility between two profiles
function calculateCompatibility(profile1: any, profile2: any) {
  let scores: any = {
    communication_style_match: 0,
    response_time_compatibility: 0,
    social_battery_compatibility: 0,
    activity_level_compatibility: 0,
    attachment_compatibility: 0,
    emotional_needs_compatibility: 0,
    conflict_style_compatibility: 0
  };

  let strengths: string[] = [];
  let challenges: string[] = [];
  let icebreakers: string[] = [];

  // Communication style match
  if (profile1.communication_style && profile2.communication_style) {
    if (profile1.communication_style === profile2.communication_style) {
      scores.communication_style_match = 90;
      strengths.push(`Both prefer ${profile1.communication_style} communication style`);
    } else {
      scores.communication_style_match = 60;
      icebreakers.push(`I notice we have different communication styles - how do you prefer to stay in touch?`);
    }
  }

  // MBTI compatibility
  if (profile1.mbti && profile2.mbti) {
    const mbti1 = profile1.mbti;
    const mbti2 = profile2.mbti;

    // Same MBTI = high compatibility
    if (mbti1 === mbti2) {
      scores.attachment_compatibility += 40;
      strengths.push(`Both ${mbti1} types - likely understand each other well`);
    }

    // Compatible cognitive functions
    if (mbti1.slice(0, 2) === mbti2.slice(0, 2)) {
      scores.attachment_compatibility += 30;
      strengths.push('Share same cognitive functions');
    }

    // E-I balance
    if (mbti1[0] !== mbti2[0]) {
      scores.social_battery_compatibility += 35;
      strengths.push('Introvert-Extrovert balance - good social battery match');
      icebreakers.push(`What's your ideal social mix - quiet nights or big events?`);
    }
  }

  // Love languages compatibility
  if (profile1.love_languages && profile2.love_languages && profile1.love_languages.length > 0 && profile2.love_languages.length > 0) {
    const common = profile1.love_languages.filter((ll: string) => profile2.love_languages.includes(ll));
    if (common.length > 0) {
      scores.emotional_needs_compatibility += 40 * common.length;
      strengths.push(`Share love language(s): ${common.join(', ')}`);
    }
  }

  // Attachment style compatibility
  if (profile1.attachment_style && profile2.attachment_style) {
    if (profile1.attachment_style === profile2.attachment_style) {
      scores.attachment_compatibility += 50;
      if (profile1.attachment_style === 'secure') {
        strengths.push('Both have secure attachment styles - great foundation');
      } else {
        challenges.push(`Both identify as ${profile1.attachment_style} - may need conscious effort`);
        icebreakers.push(`How do you think your attachment style affects your relationships?`);
      }
    } else if (profile1.attachment_style === 'secure' || profile2.attachment_style === 'secure') {
      scores.attachment_compatibility += 35;
      strengths.push('One secure attachment style can provide stability');
    }
  }

  // Interest overlap
  if (profile1.interests && profile2.interests) {
    const commonInterests = (profile1.interests as string[]).filter((i: string) =>
      (profile2.interests as string[]).includes(i)
    );
    if (commonInterests.length > 0) {
      scores.activity_level_compatibility += 20 * commonInterests.length;
      strengths.push(`Shared interests: ${commonInterests.slice(0, 3).join(', ')}`);
      icebreakers.push(`I noticed we're both into ${commonInterests[0]} - what got you into that?`);
    }
  }

  // Hobby overlap
  if (profile1.hobbies && profile2.hobbies) {
    const commonHobbies = (profile1.hobbies as string[]).filter((h: string) =>
      (profile2.hobbies as string[]).includes(h)
    );
    if (commonHobbies.length > 0) {
      scores.activity_level_compatibility += 15 * commonHobbies.length;
    }
  }

  // Lifestyle compatibility
  let lifestyleScore = 0;
  if (profile1.exercise_habit && profile2.exercise_habit) {
    if (profile1.exercise_habit === profile2.exercise_habit) {
      lifestyleScore += 25;
      strengths.push('Similar exercise habits');
    }
  }

  if (profile1.diet && profile2.diet) {
    if (profile1.diet === profile2.diet) {
      lifestyleScore += 20;
      strengths.push(`Both follow ${profile1.diet} diet`);
    }
  }

  scores.activity_level_compatibility += lifestyleScore / 2;

  // Calculate overall
  const totalScore = Object.values(scores).reduce((sum: number, val: any) => sum + val, 0);
  const maxScore = 7 * 100;
  const overallCompatibility = Math.min(100, Math.round((totalScore / maxScore) * 100));

  return {
    communication_style_match: Math.min(100, scores.communication_style_match),
    response_time_compatibility: 70,
    social_battery_compatibility: Math.min(100, scores.social_battery_compatibility + 30),
    activity_level_compatibility: Math.min(100, scores.activity_level_compatibility + 30),
    attachment_compatibility: Math.min(100, scores.attachment_compatibility + 30),
    emotional_needs_compatibility: Math.min(100, scores.emotional_needs_compatibility + 30),
    conflict_style_compatibility: 65,
    overall_compatibility: overallCompatibility,
    strengths: strengths.slice(0, 5),
    potential_challenges: challenges.slice(0, 3),
    conversation_icebreakers: icebreakers.slice(0, 4)
  };
}

// Get or calculate chemistry prediction
router.get('/:targetUserId', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.params;

    // Check for cached prediction
    const cachedResult = await pool.query(
      `SELECT * FROM chemistry_predictions
      WHERE user_id = $1 AND target_user_id = $2
      AND calculated_at > NOW() - INTERVAL '7 days'`,
      [userId, targetUserId]
    );

    if (cachedResult.rows.length > 0) {
      return res.json(cachedResult.rows[0]);
    }

    // Get both profiles
    const profilesResult = await pool.query(
      `SELECT
        p.*,
        v.social_battery,
        v.current_mood,
        v.current_intent
      FROM profiles p
      LEFT JOIN vibe_checks v ON p.user_id = v.user_id
      WHERE p.user_id IN ($1, $2)`,
      [userId, targetUserId]
    );

    if (profilesResult.rows.length < 2) {
      return res.status(404).json({ error: 'One or both profiles not found' });
    }

    const profile1 = profilesResult.rows.find((p: any) => p.user_id === userId);
    const profile2 = profilesResult.rows.find((p: any) => p.user_id === targetUserId);

    // Calculate compatibility
    const prediction = calculateCompatibility(profile1, profile2);

    // Cache the result
    const insertResult = await pool.query(
      `INSERT INTO chemistry_predictions (
        user_id,
        target_user_id,
        communication_style_match,
        response_time_compatibility,
        social_battery_compatibility,
        activity_level_compatibility,
        attachment_compatibility,
        emotional_needs_compatibility,
        conflict_style_compatibility,
        overall_compatibility,
        strengths,
        potential_challenges,
        conversation_icebreakers,
        communication_pattern_analysis
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (user_id, target_user_id)
      DO UPDATE SET
        communication_style_match = EXCLUDED.communication_style_match,
        response_time_compatibility = EXCLUDED.response_time_compatibility,
        social_battery_compatibility = EXCLUDED.social_battery_compatibility,
        activity_level_compatibility = EXCLUDED.activity_level_compatibility,
        attachment_compatibility = EXCLUDED.attachment_compatibility,
        emotional_needs_compatibility = EXCLUDED.emotional_needs_compatibility,
        conflict_style_compatibility = EXCLUDED.conflict_style_compatibility,
        overall_compatibility = EXCLUDED.overall_compatibility,
        strengths = EXCLUDED.strengths,
        potential_challenges = EXCLUDED.potential_challenges,
        conversation_icebreakers = EXCLUDED.conversation_icebreakers,
        calculated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        userId,
        targetUserId,
        prediction.communication_style_match,
        prediction.response_time_compatibility,
        prediction.social_battery_compatibility,
        prediction.activity_level_compatibility,
        prediction.attachment_compatibility,
        prediction.emotional_needs_compatibility,
        prediction.conflict_style_compatibility,
        prediction.overall_compatibility,
        prediction.strengths,
        prediction.potential_challenges,
        prediction.conversation_icebreakers,
        { has_chat_history: false }
      ]
    );

    res.json(insertResult.rows[0]);
  } catch (error) {
    console.error('Error calculating chemistry:', error);
    res.status(500).json({ error: 'Failed to calculate chemistry' });
  }
});

// Get multiple chemistry predictions (for list of matches)
router.post('/batch', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { targetUserIds } = req.body;

    if (!Array.isArray(targetUserIds)) {
      return res.status(400).json({ error: 'targetUserIds must be an array' });
    }

    const results: any[] = [];

    for (const targetUserId of targetUserIds) {
      // Check for cached prediction first
      const cachedResult = await pool.query(
        `SELECT * FROM chemistry_predictions
        WHERE user_id = $1 AND target_user_id = $2
        AND calculated_at > NOW() - INTERVAL '7 days'`,
        [userId, targetUserId]
      );

      if (cachedResult.rows.length > 0) {
        results.push(cachedResult.rows[0]);
        continue;
      }

      // Get both profiles
      const profilesResult = await pool.query(
        `SELECT p.*, v.social_battery, v.current_mood, v.current_intent
        FROM profiles p
        LEFT JOIN vibe_checks v ON p.user_id = v.user_id
        WHERE p.user_id IN ($1, $2)`,
        [userId, targetUserId]
      );

      if (profilesResult.rows.length < 2) {
        continue;
      }

      const profile1 = profilesResult.rows.find((p: any) => p.user_id === userId);
      const profile2 = profilesResult.rows.find((p: any) => p.user_id === targetUserId);

      const prediction = calculateCompatibility(profile1, profile2);

      results.push({
        user_id: userId,
        target_user_id: targetUserId,
        ...prediction
      });
    }

    res.json(results);
  } catch (error) {
    console.error('Error calculating batch chemistry:', error);
    res.status(500).json({ error: 'Failed to calculate chemistry' });
  }
});

// Delete cached prediction
router.delete('/:targetUserId', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.params;

    await pool.query(
      'DELETE FROM chemistry_predictions WHERE user_id = $1 AND target_user_id = $2',
      [userId, targetUserId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chemistry prediction:', error);
    res.status(500).json({ error: 'Failed to delete prediction' });
  }
});

export default router;
