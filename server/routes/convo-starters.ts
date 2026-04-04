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

// Generate AI conversation starters for a match
router.get('/match/:matchId', asyncHandler(async (req: AuthRequest, res) => {
  const { matchId } = req.params;

  // Check if match exists and involves this user
  const matchCheck = await pool.query(
    'SELECT * FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
    [matchId, req.userId]
  );

  if (matchCheck.rows.length === 0) {
    throw new AppError('Match not found', 404);
  }

  const match = matchCheck.rows[0];
  const otherUserId = match.user1_id === req.userId ? match.user2_id : match.user1_id;

  // Check if starters already exist
  const existing = await pool.query(
    'SELECT * FROM convo_starters WHERE match_id = $1',
    [matchId]
  );

  if (existing.rows.length > 0) {
    // If generated within last 24 hours, return cached
    const generated = new Date(existing.rows[0].generated_at);
    const hoursSince = (Date.now() - generated.getTime()) / (1000 * 60 * 60);

    if (hoursSince < 24) {
      return res.json(existing.rows[0]);
    }
  }

  // Get both users' profiles
  const profiles = await pool.query(
    `SELECT user_id, display_name, bio, interests, tags, intent, location, age
     FROM profiles
     WHERE user_id IN ($1, $2)`,
    [req.userId, otherUserId]
  );

  if (profiles.rows.length < 2) {
    throw new AppError('Profiles not found', 404);
  }

  const myProfile = profiles.rows.find(p => p.user_id === req.userId);
  const theirProfile = profiles.rows.find(p => p.user_id === otherUserId);

  // Generate AI conversation starters
  const starters = await generateAIConvoStarters(myProfile, theirProfile);

  // Store in database
  const result = await pool.query(
    `INSERT INTO convo_starters
     (match_id, shared_interests, conversation_prompts, fun_questions, deep_questions, compatibility_insights)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (match_id)
     DO UPDATE SET
       shared_interests = $2,
       conversation_prompts = $3,
       fun_questions = $4,
       deep_questions = $5,
       compatibility_insights = $6,
       generated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      matchId,
      starters.shared_interests,
      starters.conversation_prompts,
      starters.fun_questions,
      starters.deep_questions,
      starters.compatibility_insights
    ]
  );

  // Update analytics
  await pool.query(
    `INSERT INTO convo_starter_analytics (date, total_generated)
     VALUES (CURRENT_DATE, 1)
     ON CONFLICT (date)
     DO UPDATE SET total_generated = convo_starter_analytics.total_generated + 1`,
  );

  res.json(result.rows[0]);
}));

// Submit feedback on a conversation starter
router.post('/feedback/:starterId', asyncHandler(async (req: AuthRequest, res) => {
  const { starterId } = req.params;
  const {
    starter_type,
    starter_text,
    feedback_type,
    rating,
    led_to_conversation,
    response_time_hours,
    notes
  } = req.body;

  if (!['prompt', 'fun', 'deep', 'insight'].includes(starter_type)) {
    throw new AppError('Invalid starter type', 400);
  }

  if (!['used', 'helpful', 'not_helpful', 'reported'].includes(feedback_type)) {
    throw new AppError('Invalid feedback type', 400);
  }

  // Verify the starter exists and belongs to user's match
  const starterCheck = await pool.query(
    `SELECT cs.* FROM convo_starters cs
     JOIN matches m ON m.id = cs.match_id
     WHERE cs.id = $1 AND (m.user1_id = $2 OR m.user2_id = $2)`,
    [starterId, req.userId]
  );

  if (starterCheck.rows.length === 0) {
    throw new AppError('Conversation starter not found', 404);
  }

  // Insert feedback
  const result = await pool.query(
    `INSERT INTO convo_starter_feedback
     (convo_starter_id, user_id, starter_type, starter_text, feedback_type, rating, led_to_conversation, response_time_hours, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (convo_starter_id, user_id, starter_text)
     DO UPDATE SET
       feedback_type = $5,
       rating = $6,
       led_to_conversation = $7,
       response_time_hours = $8,
       notes = $9
     RETURNING *`,
    [
      starterId,
      req.userId,
      starter_type,
      starter_text,
      feedback_type,
      rating || null,
      led_to_conversation || false,
      response_time_hours || null,
      notes || null
    ]
  );

  // Update analytics
  if (feedback_type === 'used') {
    await pool.query(
      `INSERT INTO convo_starter_analytics (date, total_used, led_to_conversation)
       VALUES (CURRENT_DATE, 1, $1)
       ON CONFLICT (date)
       DO UPDATE SET
         total_used = convo_starter_analytics.total_used + 1,
         led_to_conversation = convo_starter_analytics.led_to_conversation + $1`,
      [led_to_conversation ? 1 : 0]
    );
  }

  res.json(result.rows[0]);
}));

// Get feedback for a starter
router.get('/feedback/:starterId', asyncHandler(async (req: AuthRequest, res) => {
  const { starterId } = req.params;

  // Verify access
  const starterCheck = await pool.query(
    `SELECT cs.* FROM convo_starters cs
     JOIN matches m ON m.id = cs.match_id
     WHERE cs.id = $1 AND (m.user1_id = $2 OR m.user2_id = $2)`,
    [starterId, req.userId]
  );

  if (starterCheck.rows.length === 0) {
    throw new AppError('Conversation starter not found', 404);
  }

  const result = await pool.query(
    `SELECT * FROM convo_starter_feedback WHERE convo_starter_id = $1`,
    [starterId]
  );

  res.json(result.rows);
}));

// Get analytics (admin only or for own stats)
router.get('/analytics', asyncHandler(async (req: AuthRequest, res) => {
  const { days = 30 } = req.query;

  const result = await pool.query(
    `SELECT * FROM convo_starter_analytics
     WHERE date >= CURRENT_DATE - INTERVAL '1 day' * $1
     ORDER BY date DESC`,
    [days]
  );

  res.json(result.rows);
}));

// Helper function to generate AI conversation starters
async function generateAIConvoStarters(myProfile: any, theirProfile: any) {
  // Calculate shared interests
  const myInterests = myProfile.interests || [];
  const theirInterests = theirProfile.interests || [];
  const sharedInterests = myInterests.filter((i: string) => theirInterests.includes(i));

  const conversationPrompts: string[] = [];
  const funQuestions: string[] = [];
  const deepQuestions: string[] = [];
  const compatibilityInsights: string[] = [];

  // Generate conversation prompts based on shared interests
  if (sharedInterests.length > 0) {
    conversationPrompts.push(
      `I noticed we're both into ${sharedInterests[0]}! What got you interested in that?`
    );
    conversationPrompts.push(
      `Since we both like ${sharedInterests[0]}, what's your favorite way to enjoy it?`
    );

    if (sharedInterests.length > 1) {
      conversationPrompts.push(
        `We have a few interests in common! Which one are you most passionate about right now?`
      );
    }
  }

  // Generate prompts based on their unique interests
  if (theirInterests.length > 0) {
    const uniqueInterests = theirInterests.filter((i: string) => !myInterests.includes(i));
    if (uniqueInterests.length > 0) {
      conversationPrompts.push(
        `I saw you're into ${uniqueInterests[0]} - I've been curious about that. What do you love most about it?`
      );
    }
  }

  // Bio-based prompts
  if (theirProfile.bio) {
    conversationPrompts.push(
      `Your bio caught my attention! I'd love to hear more about you.`
    );
  }

  // Fun questions
  funQuestions.push(
    "What's the most spontaneous thing you've done recently?",
    "If you could travel anywhere right now, where would you go?",
    "What's a hidden talent you have that most people don't know about?",
    "What's your go-to karaoke song (even if you'd never actually sing it)?",
    "If you could only eat one food for the rest of your life, what would it be?"
  );

  // Deep questions
  deepQuestions.push(
    "What's something you're really passionate about and why?",
    "What are you looking for in a connection right now?",
    "What's a lesson you've learned that changed your perspective?",
    "What makes you feel most alive?",
    "What's on your bucket list that you haven't told many people about?"
  );

  // Compatibility insights
  if (sharedInterests.length > 0) {
    compatibilityInsights.push(
      `You share ${sharedInterests.length} interest${sharedInterests.length > 1 ? 's' : ''}: ${sharedInterests.join(', ')}`
    );
  }

  if (myProfile.intent && theirProfile.intent) {
    const sharedIntent = myProfile.intent.filter((i: string) => theirProfile.intent.includes(i));
    if (sharedIntent.length > 0) {
      compatibilityInsights.push(
        `Both looking for: ${sharedIntent.join(' and ')}`
      );
    }
  }

  if (myProfile.location && theirProfile.location && myProfile.location === theirProfile.location) {
    compatibilityInsights.push("You're both in the same area - easy to meet up!");
  }

  // Add generic prompts if none generated
  if (conversationPrompts.length === 0) {
    conversationPrompts.push("Hey! I thought we might vibe. Want to chat?");
    conversationPrompts.push("Hi! I'm intrigued by your profile. What brings you here?");
  }

  return {
    shared_interests: sharedInterests,
    conversation_prompts: conversationPrompts.slice(0, 4),
    fun_questions: funQuestions.slice(0, 3),
    deep_questions: deepQuestions.slice(0, 3),
    compatibility_insights: compatibilityInsights
  };
}

export default router;
