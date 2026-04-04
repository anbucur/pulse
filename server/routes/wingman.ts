import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { pool } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { GoogleGenAI } from '@google/genai';
import { aiConfig } from '../config/index.js';

const router = Router();

router.use(authenticate);

const getAIClient = () => {
  if (!aiConfig.geminiApiKey) {
    throw new AppError('AI service not configured', 500);
  }
  return new GoogleGenAI({ apiKey: aiConfig.geminiApiKey });
};

router.get('/matches', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT DISTINCT
       m.id,
       m.user2_id as matched_user_id,
       COALESCE(p.display_name, 'Unknown') as display_name,
       p.age,
       p.gender,
       p.bio,
       p.photos,
       p.primary_photo_index,
       p.interests,
       p.location
     FROM matches m
     JOIN profiles p ON p.user_id = m.user2_id
     WHERE m.user1_id = $1
     UNION
     SELECT DISTINCT
       m.id,
       m.user1_id as matched_user_id,
       COALESCE(p.display_name, 'Unknown') as display_name,
       p.age,
       p.gender,
       p.bio,
       p.photos,
       p.primary_photo_index,
       p.interests,
       p.location
     FROM matches m
     JOIN profiles p ON p.user_id = m.user1_id
     WHERE m.user2_id = $1
     ORDER BY display_name`,
    [req.userId]
  );

  res.json(result.rows);
}));

router.get('/:targetUserId', asyncHandler(async (req: AuthRequest, res) => {
  const { targetUserId } = req.params;

  const result = await pool.query(
    `SELECT * FROM wingman_briefings
     WHERE user_id = $1 AND target_user_id = $2
     ORDER BY generated_at DESC
     LIMIT 1`,
    [req.userId, targetUserId]
  );

  if (result.rows.length === 0) {
    throw new AppError('No briefing found. Generate one first.', 404);
  }

  const briefing = result.rows[0];

  const profileResult = await pool.query(
    'SELECT display_name FROM profiles WHERE user_id = $1',
    [targetUserId]
  );

  res.json({
    ...briefing,
    target_display_name: profileResult.rows[0]?.display_name || 'Unknown',
  });
}));

router.post('/:targetUserId/generate', asyncHandler(async (req: AuthRequest, res) => {
  const { targetUserId } = req.params;

  if (targetUserId === req.userId) {
    throw new AppError('Cannot generate briefing for yourself', 400);
  }

  const myProfileResult = await pool.query(
    'SELECT * FROM profiles WHERE user_id = $1',
    [req.userId]
  );

  const theirProfileResult = await pool.query(
    'SELECT * FROM profiles WHERE user_id = $1',
    [targetUserId]
  );

  if (myProfileResult.rows.length === 0 || theirProfileResult.rows.length === 0) {
    throw new AppError('Profile not found', 404);
  }

  const myProfile = myProfileResult.rows[0];
  const theirProfile = theirProfileResult.rows[0];

  const ai = getAIClient();

  const prompt = `You are Wingman AI, a dating coach that analyzes two people's profiles and provides dating advice.

Generate a comprehensive briefing for a date between two people.

Return ONLY a JSON object with this exact structure:
{
  "compatibility_score": <0-100>,
  "date_ideas": ["<idea 1>", "<idea 2>", "<idea 3>"],
  "conversation_starters": ["<starter 1>", "<starter 2>", "<starter 3>"],
  "compatibility_notes": "<2-3 paragraph analysis of their compatibility>",
  "key_observations": ["<observation 1>", "<observation 2>", "<observation 3>"]
}

PERSON A (You):
- Name: ${myProfile.display_name || 'Not set'}
- Age: ${myProfile.age || 'Not set'}
- Gender: ${myProfile.gender || 'Not set'}
- Bio: ${myProfile.bio || 'Not provided'}
- Interests: ${myProfile.interests?.join(', ') || 'Not specified'}
- Location: ${myProfile.location || 'Not specified'}
- MBTI: ${myProfile.mbti || 'Not specified'}
- Love Languages: ${myProfile.love_languages?.join(', ') || 'Not specified'}
- Attachment Style: ${myProfile.attachment_style || 'Not specified'}
- Relationship Style: ${myProfile.relationship_style?.join(', ') || 'Not specified'}

PERSON B (Your Date):
- Name: ${theirProfile.display_name || 'Not set'}
- Age: ${theirProfile.age || 'Not set'}
- Gender: ${theirProfile.gender || 'Not set'}
- Bio: ${theirProfile.bio || 'Not provided'}
- Interests: ${theirProfile.interests?.join(', ') || 'Not specified'}
- Location: ${theirProfile.location || 'Not specified'}
- MBTI: ${theirProfile.mbti || 'Not specified'}
- Love Languages: ${theirProfile.love_languages?.join(', ') || 'Not specified'}
- Attachment Style: ${theirProfile.attachment_style || 'Not specified'}
- Relationship Style: ${theirProfile.relationship_style?.join(', ') || 'Not specified'}

Date ideas should be specific and varied (low-key, medium, and adventurous options).
Conversation starters should be personalized based on their profile, interests, or bio.
Compatibility notes should discuss strengths, potential challenges, and how to make the date successful.
Key observations should highlight interesting things to note about their personality or preferences.

Return ONLY the JSON object, no additional text.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  let briefingData;
  try {
    briefingData = JSON.parse(response.text || '{}');
  } catch (e) {
    briefingData = {
      compatibility_score: 70,
      date_ideas: [
        'Coffee at a cozy local cafe - low pressure environment to chat',
        'Visit a museum or art gallery - great for conversation topics',
        'Take a walk in a scenic park - relaxed and allows for deeper conversation',
      ],
      conversation_starters: [
        'What was the highlight of your week so far?',
        'If you could travel anywhere right now, where would you go?',
        'What is something you are currently excited about?',
      ],
      compatibility_notes: 'You both seem to have overlapping interests that could make for great conversation. Take time to listen actively and find common ground.',
      key_observations: [
        'Make sure to ask about their interests in detail',
        'Be genuine and authentic - they value honesty',
        'Suggest activities that allow for conversation',
      ],
    };
  }

  const result = await pool.query(
    `INSERT INTO wingman_briefings (
       user_id, target_user_id, compatibility_score,
       date_ideas, conversation_starters, compatibility_notes, key_observations
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, target_user_id)
     DO UPDATE SET
       compatibility_score = EXCLUDED.compatibility_score,
       date_ideas = EXCLUDED.date_ideas,
       conversation_starters = EXCLUDED.conversation_starters,
       compatibility_notes = EXCLUDED.compatibility_notes,
       key_observations = EXCLUDED.key_observations,
       generated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      req.userId,
      targetUserId,
      briefingData.compatibility_score || 50,
      briefingData.date_ideas || [],
      briefingData.conversation_starters || [],
      briefingData.compatibility_notes || '',
      briefingData.key_observations || [],
    ]
  );

  res.json({
    ...result.rows[0],
    target_display_name: theirProfile.display_name || 'Unknown',
  });
}));

router.delete('/:targetUserId', asyncHandler(async (req: AuthRequest, res) => {
  const { targetUserId } = req.params;

  await pool.query(
    'DELETE FROM wingman_briefings WHERE user_id = $1 AND target_user_id = $2',
    [req.userId, targetUserId]
  );

  res.json({ message: 'Briefing deleted' });
}));

export default router;