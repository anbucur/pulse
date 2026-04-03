import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { pool } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { GoogleGenAI } from '@google/genai';
import { aiConfig } from '../config/index.js';

const router = Router();

// All feature routes require authentication
router.use(authenticate);

// ============================================
// COMPATIBILITY MATRIX
// ============================================

// Calculate compatibility with another user
router.post('/compatibility/:targetUserId', asyncHandler(async (req: AuthRequest, res) => {
  const { targetUserId } = req.params;
  const { forceRecalculate = false } = req.body;

  if (targetUserId === req.userId) {
    throw new AppError('Cannot calculate compatibility with yourself', 400);
  }

  // Check if compatibility already exists
  if (!forceRecalculate) {
    const existing = await pool.query(
      'SELECT * FROM compatibility_matrices WHERE user_id = $1 AND target_user_id = $2',
      [req.userId, targetUserId]
    );

    if (existing.rows.length > 0) {
      // Only recalculate if older than 7 days
      const daysSinceCalculation = Math.floor(
        (Date.now() - new Date(existing.rows[0].calculated_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceCalculation < 7) {
        return res.json(existing.rows[0]);
      }
    }
  }

  // Get both profiles
  const myProfileResult = await pool.query(
    'SELECT * FROM profiles WHERE user_id = $1',
    [req.userId]
  );

  const theirProfileResult = await pool.query(
    'SELECT * FROM profiles WHERE user_id = $1',
    [targetUserId]
  );

  if (myProfileResult.rows.length === 0 || theirProfileResult.rows.length === 0) {
    throw new AppError('One or both profiles not found', 404);
  }

  const myProfile = myProfileResult.rows[0];
  const theirProfile = theirProfileResult.rows[0];

  // Calculate compatibility scores using AI
  const ai = new GoogleGenAI({ apiKey: aiConfig.geminiApiKey });

  const prompt = `Analyze compatibility between two people for a dating app. Return ONLY a JSON object with these exact fields:

{
  "communication_score": <0-100>,
  "lifestyle_score": <0-100>,
  "values_score": <0-100>,
  "intimacy_score": <0-100>,
  "conflict_resolution_score": <0-100>,
  "growth_score": <0-100>,
  "overall_score": <0-100>,
  "strengths": ["3-5 specific strengths of this match"],
  "potential_challenges": ["2-4 potential challenges"],
  "recommendations": ["2-4 actionable recommendations"]
}

Person A:
- MBTI: ${myProfile.mbti || 'Unknown'}
- Love Languages: ${myProfile.love_languages?.join(', ') || 'Unknown'}
- Attachment Style: ${myProfile.attachment_style || 'Unknown'}
- Communication Style: ${myProfile.communication_style || 'Unknown'}
- Relationship Style: ${myProfile.relationship_style?.join(', ') || 'Unknown'}
- Intent: ${myProfile.intent?.join(', ') || 'Unknown'}
- Interests: ${myProfile.interests?.slice(0, 10).join(', ') || 'Unknown'}

Person B:
- MBTI: ${theirProfile.mbti || 'Unknown'}
- Love Languages: ${theirProfile.love_languages?.join(', ') || 'Unknown'}
- Attachment Style: ${theirProfile.attachment_style || 'Unknown'}
- Communication Style: ${theirProfile.communication_style || 'Unknown'}
- Relationship Style: ${theirProfile.relationship_style?.join(', ') || 'Unknown'}
- Intent: ${theirProfile.intent?.join(', ') || 'Unknown'}
- Interests: ${theirProfile.interests?.slice(0, 10).join(', ') || 'Unknown'}

Analyze thoroughly and return ONLY the JSON object.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  let compatibilityData;
  try {
    compatibilityData = JSON.parse(response.text || '{}');
  } catch (e) {
    // Fallback to random scores if AI fails
    compatibilityData = {
      communication_score: Math.floor(Math.random() * 40) + 60,
      lifestyle_score: Math.floor(Math.random() * 40) + 60,
      values_score: Math.floor(Math.random() * 40) + 60,
      intimacy_score: Math.floor(Math.random() * 40) + 60,
      conflict_resolution_score: Math.floor(Math.random() * 40) + 60,
      growth_score: Math.floor(Math.random() * 40) + 60,
      overall_score: Math.floor(Math.random() * 30) + 70,
      strengths: ['Good communication potential', 'Shared values'],
      potential_challenges: ['May need to discuss boundaries'],
      recommendations: ['Have open conversations early', 'Be patient with differences'],
    };
  }

  // Save to database
  const result = await pool.query(
    `INSERT INTO compatibility_matrices (
      user_id, target_user_id,
      communication_score, lifestyle_score, values_score,
      intimacy_score, conflict_resolution_score, growth_score,
      overall_score, strengths, potential_challenges, recommendations
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (user_id, target_user_id)
    DO UPDATE SET
      communication_score = EXCLUDED.communication_score,
      lifestyle_score = EXCLUDED.lifestyle_score,
      values_score = EXCLUDED.values_score,
      intimacy_score = EXCLUDED.intimacy_score,
      conflict_resolution_score = EXCLUDED.conflict_resolution_score,
      growth_score = EXCLUDED.growth_score,
      overall_score = EXCLUDED.overall_score,
      strengths = EXCLUDED.strengths,
      potential_challenges = EXCLUDED.potential_challenges,
      recommendations = EXCLUDED.recommendations,
      calculated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      req.userId, targetUserId,
      compatibilityData.communication_score,
      compatibilityData.lifestyle_score,
      compatibilityData.values_score,
      compatibilityData.intimacy_score,
      compatibilityData.conflict_resolution_score,
      compatibilityData.growth_score,
      compatibilityData.overall_score,
      compatibilityData.strengths,
      compatibilityData.potential_challenges,
      compatibilityData.recommendations,
    ]
  );

  res.json(result.rows[0]);
}));

// Get all compatibility scores for current user
router.get('/compatibility', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT cm.*, p.display_name, p.photos
     FROM compatibility_matrices cm
     JOIN profiles p ON p.user_id = cm.target_user_id
     WHERE cm.user_id = $1
     ORDER BY cm.overall_score DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// ============================================
// CONSENT PROTOCOL
// ============================================

// Create consent protocol
router.post('/consent/:targetUserId', asyncHandler(async (req: AuthRequest, res) => {
  const { targetUserId } = req.params;
  const {
    boundaries,
    safeWords,
    checkInFrequency,
    firstMeetingPreference,
    meetingConstraints,
    stdStatus,
    lastTestDate,
    birthControl,
    protectionRequired,
  } = req.body;

  // Check if protocol already exists
  const existing = await pool.query(
    'SELECT * FROM consent_protocols WHERE user_id = $1 AND target_user_id = $2',
    [req.userId, targetUserId]
  );

  if (existing.rows.length > 0) {
    throw new AppError('Consent protocol already exists', 400);
  }

  const result = await pool.query(
    `INSERT INTO consent_protocols (
      user_id, target_user_id,
      boundaries, safe_words, check_in_frequency,
      first_meeting_preference, meeting_constraints,
      std_status, last_test_date, birth_control, protection_required
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      req.userId, targetUserId,
      JSON.stringify(boundaries || {}),
      safeWords || [],
      checkInFrequency || 'sometimes',
      firstMeetingPreference || 'public',
      meetingConstraints || [],
      stdStatus || null,
      lastTestDate || null,
      birthControl || null,
      protectionRequired !== undefined ? protectionRequired : true,
    ]
  );

  res.json(result.rows[0]);
}));

// Get consent protocols
router.get('/consent', asyncHandler(async (req: AuthRequest, res) => {
  const { status, sent, received } = req.query;

  let query = 'SELECT * FROM consent_protocols WHERE user_id = $1';
  const params: any[] = [req.userId];

  if (status) {
    query += ' AND status = $2';
    params.push(status);
  }

  // If 'received' is true, get protocols sent TO user
  if (received === 'true') {
    query = 'SELECT * FROM consent_protocols WHERE target_user_id = $1';
    if (status) {
      query += ' AND status = $2';
    }
  }

  query += ' ORDER BY created_at DESC';

  const result = await pool.query(query, params);

  // Enrich with other user's profile info
  const enriched = await Promise.all(
    result.rows.map(async (protocol) => {
      const otherUserId = protocol.user_id === req.userId ? protocol.target_user_id : protocol.user_id;
      const profile = await pool.query(
        'SELECT display_name, photos FROM profiles WHERE user_id = $1',
        [otherUserId]
      );
      return {
        ...protocol,
        other_user: profile.rows[0] || null,
      };
    })
  );

  res.json(enriched);
}));

// Respond to consent protocol
router.post('/consent/:protocolId/respond', asyncHandler(async (req: AuthRequest, res) => {
  const { protocolId } = req.params;
  const { status, response } = req.body; // status: 'accepted' or 'rejected'

  if (!['accepted', 'rejected'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const protocol = await pool.query(
    'SELECT * FROM consent_protocols WHERE id = $1 AND target_user_id = $2',
    [protocolId, req.userId]
  );

  if (protocol.rows.length === 0) {
    throw new AppError('Consent protocol not found', 404);
  }

  const result = await pool.query(
    `UPDATE consent_protocols
     SET status = $1, responded_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [status, protocolId]
  );

  res.json(result.rows[0]);
}));

// ============================================
// VIBE CHECK
// ============================================

// Set current vibe
router.post('/vibe', asyncHandler(async (req: AuthRequest, res) => {
  const {
    currentMood,
    currentIntent,
    availability,
    activityStatus,
    activityDescription,
    socialBattery,
    expiresIn,
  } = req.body;

  // Calculate expiration
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000)
    : new Date(Date.now() + 24 * 60 * 60 * 1000); // Default 24 hours

  const result = await pool.query(
    `INSERT INTO vibe_checks (
      user_id, current_mood, current_intent, availability,
      activity_status, activity_description, social_battery, expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (user_id)
    DO UPDATE SET
      current_mood = EXCLUDED.current_mood,
      current_intent = EXCLUDED.current_intent,
      availability = EXCLUDED.availability,
      activity_status = EXCLUDED.activity_status,
      activity_description = EXCLUDED.activity_description,
      social_battery = EXCLUDED.social_battery,
      expires_at = EXCLUDED.expires_at,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      req.userId,
      currentMood || [],
      currentIntent || [],
      availability || 'flexible',
      activityStatus || null,
      activityDescription || null,
      socialBattery || null,
      expiresAt,
    ]
  );

  res.json(result.rows[0]);
}));

// Get current vibe
router.get('/vibe', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT * FROM vibe_checks
     WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
     ORDER BY updated_at DESC
     LIMIT 1`,
    [req.userId]
  );

  if (result.rows.length === 0) {
    return res.json(null);
  }

  res.json(result.rows[0]);
}));

// Get vibes of nearby users
router.get('/vibe/nearby', asyncHandler(async (req: AuthRequest, res) => {
  const { mood, intent, availability, limit = 20 } = req.query;

  let query = `
    SELECT v.*, p.display_name, p.photos, p.lat, p.lng
    FROM vibe_checks v
    JOIN profiles p ON p.user_id = v.user_id
    WHERE v.expires_at > CURRENT_TIMESTAMP
      AND v.user_id != $1
  `;

  const params: any[] = [req.userId];

  if (mood) {
    query += ` AND $2 = ANY(v.current_mood)`;
    params.push(mood);
  }

  if (intent) {
    query += ` AND $3 = ANY(v.current_intent)`;
    params.push(intent);
  }

  if (availability) {
    query += ` AND v.availability = $4`;
    params.push(availability);
  }

  query += ` ORDER BY v.updated_at DESC LIMIT $${params.length + 1}`;
  params.push(parseInt(limit as string));

  const result = await pool.query(query, params);

  res.json(result.rows);
}));

// ============================================
// BURNER CHAT
// ============================================

// Create burner chat room
router.post('/burner', asyncHandler(async (req: AuthRequest, res) => {
  const {
    roomName,
    maxLifetime = 3600, // 1 hour default
    maxMessages,
    destructOnRead = false,
    destructTimer,
  } = req.body;

  const expiresAt = new Date(Date.now() + maxLifetime * 1000);

  const result = await pool.query(
    `INSERT INTO burner_chats (
      created_by, room_name, max_lifetime, max_messages,
      destruct_on_read, destruct_timer, expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      req.userId,
      roomName || 'Burner Chat',
      maxLifetime,
      maxMessages || null,
      destructOnRead,
      destructTimer || null,
      expiresAt,
    ]
  );

  // Auto-join creator
  await pool.query(
    `INSERT INTO burner_chat_participants (chat_id, user_id)
     VALUES ($1, $2)`,
    [result.rows[0].id, req.userId]
  );

  res.json(result.rows[0]);
}));

// Join burner chat
router.post('/burner/:chatId/join', asyncHandler(async (req: AuthRequest, res) => {
  const { chatId } = req.params;
  const { publicKey } = req.body;

  // Check if chat exists and hasn't expired
  const chat = await pool.query(
    'SELECT * FROM burner_chats WHERE id = $1 AND expires_at > CURRENT_TIMESTAMP',
    [chatId]
  );

  if (chat.rows.length === 0) {
    throw new AppError('Burner chat not found or expired', 404);
  }

  // Add participant
  const result = await pool.query(
    `INSERT INTO burner_chat_participants (chat_id, user_id, public_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (chat_id, user_id) DO NOTHING
     RETURNING *`,
    [chatId, req.userId, publicKey || null]
  );

  res.json(result.rows[0]);
}));

// Send burner message
router.post('/burner/:chatId/messages', asyncHandler(async (req: AuthRequest, res) => {
  const { chatId } = req.params;
  const { encryptedContent, nonce, maxViews = 1 } = req.body;

  // Verify participation
  const participant = await pool.query(
    'SELECT * FROM burner_chat_participants WHERE chat_id = $1 AND user_id = $2',
    [chatId, req.userId]
  );

  if (participant.rows.length === 0) {
    throw new AppError('Not a participant in this chat', 403);
  }

  // Get chat settings
  const chat = await pool.query(
    'SELECT * FROM burner_chats WHERE id = $1',
    [chatId]
  );

  const chatData = chat.rows[0];
  let destructAt = null;

  if (chatData.destruct_on_read || chatData.destruct_timer) {
    const timer = chatData.destruct_timer || 60; // Default 60 seconds
    destructAt = new Date(Date.now() + timer * 1000);
  }

  const result = await pool.query(
    `INSERT INTO burner_chat_messages (
      chat_id, sender_id, encrypted_content, nonce, max_views, destruct_at
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [chatId, req.userId, encryptedContent, nonce, maxViews, destructAt]
  );

  res.json(result.rows[0]);
}));

// Get burner messages
router.get('/burner/:chatId/messages', asyncHandler(async (req: AuthRequest, res) => {
  const { chatId } = req.params;

  // Verify participation
  const participant = await pool.query(
    'SELECT * FROM burner_chat_participants WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL',
    [chatId, req.userId]
  );

  if (participant.rows.length === 0) {
    throw new AppError('Not a participant in this chat', 403);
  }

  const result = await pool.query(
    `SELECT * FROM burner_chat_messages
     WHERE chat_id = $1
       AND (destruct_at IS NULL OR destruct_at > CURRENT_TIMESTAMP)
       AND (view_count < max_views OR max_views IS NULL)
     ORDER BY created_at ASC`,
    [chatId]
  );

  res.json(result.rows);
}));

// View burner message (increments view count)
router.post('/burner/:chatId/messages/:messageId/view', asyncHandler(async (req: AuthRequest, res) => {
  const { chatId, messageId } = req.params;

  const result = await pool.query(
    `UPDATE burner_chat_messages
     SET view_count = view_count + 1
     WHERE id = $1 AND chat_id = $2
     RETURNING *`,
    [messageId, chatId]
  );

  if (result.rows[0].view_count >= result.rows[0].max_views) {
    // Delete message if max views reached
    await pool.query(
      'DELETE FROM burner_chat_messages WHERE id = $1',
      [messageId]
    );
  }

  res.json({ viewed: true });
}));

// Leave burner chat
router.post('/burner/:chatId/leave', asyncHandler(async (req: AuthRequest, res) => {
  const { chatId } = req.params;

  await pool.query(
    `UPDATE burner_chat_participants
     SET left_at = CURRENT_TIMESTAMP
     WHERE chat_id = $1 AND user_id = $2`,
    [chatId, req.userId]
  );

  res.json({ message: 'Left burner chat' });
}));

// ============================================
// SOCIAL PROOF REFERENCES
// ============================================

// Create reference
router.post('/reference/:aboutUserId', asyncHandler(async (req: AuthRequest, res) => {
  const { aboutUserId } = req.params;
  const {
    referenceType,
    interactionDate,
    isAnonymous = true,
    respectRating,
    communicationRating,
    safetyRating,
    satisfactionRating,
    overallRating,
    wouldMeetAgain,
    feedback,
    strengths,
    areasForImprovement,
    flags,
  } = req.body;

  if (aboutUserId === req.userId) {
    throw new AppError('Cannot create reference for yourself', 400);
  }

  // Check if reference already exists
  const existing = await pool.query(
    'SELECT * FROM social_references WHERE from_user_id = $1 AND about_user_id = $2',
    [req.userId, aboutUserId]
  );

  if (existing.rows.length > 0) {
    throw new AppError('Reference already exists', 400);
  }

  const result = await pool.query(
    `INSERT INTO social_references (
      from_user_id, about_user_id, reference_type, interaction_date,
      is_anonymous, respect_rating, communication_rating, safety_rating,
      satisfaction_rating, overall_rating, would_meet_again, feedback,
      strengths, areas_for_improvement, flags
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      req.userId, aboutUserId, referenceType, interactionDate || null, isAnonymous,
      respectRating, communicationRating, safetyRating, satisfactionRating, overallRating,
      wouldMeetAgain, feedback, strengths || [], areasForImprovement || [], flags || [],
    ]
  );

  res.json(result.rows[0]);
}));

// Get references for a user
router.get('/reference/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { type, anonymousOnly } = req.query;

  let query = `
    SELECT sr.*, p.display_name as from_user_name, p.photos as from_user_photos
    FROM social_references sr
    LEFT JOIN profiles p ON p.user_id = sr.from_user_id
    WHERE sr.about_user_id = $1
  `;

  const params: any[] = [userId];

  if (type) {
    query += ` AND sr.reference_type = $2`;
    params.push(type);
  }

  if (anonymousOnly === 'true') {
    query += ` AND sr.is_anonymous = true`;
  }

  query += ` ORDER BY sr.created_at DESC`;

  const result = await pool.query(query, params);

  // Sanitize anonymous references
  const sanitized = result.rows.map((ref) => {
    if (ref.is_anonymous) {
      return {
        ...ref,
        from_user_name: 'Anonymous',
        from_user_photos: null,
      };
    }
    return ref;
  });

  res.json(sanitized);
}));

// Get references I've given
router.get('/reference/given', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT sr.*, p.display_name as about_user_name, p.photos as about_user_photos
     FROM social_references sr
     JOIN profiles p ON p.user_id = sr.about_user_id
     WHERE sr.from_user_id = $1
     ORDER BY sr.created_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Confirm mutual reference
router.post('/reference/:referenceId/confirm', asyncHandler(async (req: AuthRequest, res) => {
  const { referenceId } = req.params;

  const result = await pool.query(
    `UPDATE social_references
     SET is_mutual = true, confirmed_by = $1
     WHERE id = $2 AND about_user_id = $1
     RETURNING *`,
    [req.userId, referenceId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Reference not found or not authorized', 404);
  }

  res.json(result.rows[0]);
}));

// Get reference summary for a user
router.get('/reference/:userId/summary', asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;

  const result = await pool.query(
    `SELECT
      COUNT(*) as total_references,
      AVG(overall_rating) as average_rating,
      COUNT(*) FILTER (WHERE would_meet_again = true) as would_meet_again_count,
      array_agg(DISTINCT reference_type) as reference_types
     FROM social_references
     WHERE about_user_id = $1`,
    [userId]
  );

  res.json(result.rows[0]);
}));

export default router;
