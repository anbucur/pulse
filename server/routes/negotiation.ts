/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { pool } from '../config/index.js';

const router = express.Router();

// GET /api/negotiation/categories - Get all negotiation categories
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM negotiation_categories WHERE is_active = true ORDER BY display_order ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/negotiation/questions - Get all active questions
router.get('/questions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT q.*, c.name as category_name, c.icon as category_icon, c.display_order as category_order
      FROM negotiation_questions q
      JOIN negotiation_categories c ON c.id = q.category_id
      WHERE q.is_active = true AND c.is_active = true
      ORDER BY c.display_order ASC, q.display_order ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// GET /api/negotiation/sessions - Get user's negotiation sessions
router.get('/sessions', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = userResult.rows[0].id;

    const result = await pool.query(
      `SELECT ns.*,
        p1.display_name as initiated_by_name,
        p2.display_name as with_user_name
      FROM negotiation_sessions ns
      LEFT JOIN profiles p1 ON p1.user_id = ns.initiated_by
      LEFT JOIN profiles p2 ON p2.user_id = ns.with_user_id
      WHERE ns.initiated_by = $1 OR ns.with_user_id = $1
      ORDER BY ns.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/negotiation/sessions/:id - Get a specific session with answers
router.get('/sessions/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = userResult.rows[0].id;
    const { id } = req.params;

    // Check if user is part of this session
    const sessionCheck = await pool.query(
      'SELECT * FROM negotiation_sessions WHERE id = $1 AND (initiated_by = $2 OR with_user_id = $2)',
      [id, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionCheck.rows[0];

    // Get all answers for this session
    const answersResult = await pool.query(
      `SELECT na.*, q.question_text, q.question_type, q.options, q.category_id, c.name as category_name
      FROM negotiation_answers na
      JOIN negotiation_questions q ON q.id = na.question_id
      JOIN negotiation_categories c ON c.id = q.category_id
      WHERE na.session_id = $1
      ORDER BY c.display_order ASC, q.display_order ASC`,
      [id]
    );

    // Group answers by category and user
    const answersByCategory: any = {};
    answersResult.rows.forEach((answer) => {
      if (!answersByCategory[answer.category_name]) {
        answersByCategory[answer.category_name] = {
          user1_answers: [],
          user2_answers: [],
        };
      }

      const answerData = {
        question_id: answer.question_id,
        question_text: answer.question_text,
        question_type: answer.question_type,
        answer: answer.answer,
        explanation: answer.explanation,
      };

      if (answer.user_id === session.initiated_by) {
        answersByCategory[answer.category_name].user1_answers.push(answerData);
      } else {
        answersByCategory[answer.category_name].user2_answers.push(answerData);
      }
    });

    res.json({
      ...session,
      answers: answersByCategory,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// POST /api/negotiation/sessions - Create a new negotiation session
router.post('/sessions', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = userResult.rows[0].id;
    const { with_user_id } = req.body;

    if (!with_user_id) {
      return res.status(400).json({ error: 'with_user_id is required' });
    }

    if (with_user_id === userId) {
      return res.status(400).json({ error: 'Cannot start a negotiation with yourself' });
    }

    // Check if session already exists
    const existingCheck = await pool.query(
      'SELECT * FROM negotiation_sessions WHERE initiated_by = $1 AND with_user_id = $2',
      [userId, with_user_id]
    );

    if (existingCheck.rows.length > 0) {
      return res.json(existingCheck.rows[0]);
    }

    const result = await pool.query(
      'INSERT INTO negotiation_sessions (initiated_by, with_user_id) VALUES ($1, $2) RETURNING *',
      [userId, with_user_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// POST /api/negotiation/sessions/:id/answers - Submit answers for a session
router.post('/sessions/:id/answers', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = userResult.rows[0].id;
    const { id } = req.params;
    const { answers } = req.body; // Array of { question_id, answer, explanation }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers must be an array' });
    }

    // Check if user is part of this session
    const sessionCheck = await pool.query(
      'SELECT * FROM negotiation_sessions WHERE id = $1 AND (initiated_by = $2 OR with_user_id = $2)',
      [id, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Insert or update answers
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const answer of answers) {
        await client.query(
          `INSERT INTO negotiation_answers (session_id, question_id, user_id, answer, explanation)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (session_id, question_id, user_id)
          DO UPDATE SET answer = $4, explanation = $5`,
          [id, answer.question_id, userId, answer.answer, answer.explanation]
        );
      }

      // Check if all questions are answered for this user
      const totalQuestionsResult = await client.query(
        'SELECT COUNT(*) as count FROM negotiation_questions WHERE is_active = true'
      );

      const answeredQuestionsResult = await client.query(
        'SELECT COUNT(*) as count FROM negotiation_answers WHERE session_id = $1 AND user_id = $2',
        [id, userId]
      );

      const totalQuestions = parseInt(totalQuestionsResult.rows[0].count);
      const answeredQuestions = parseInt(answeredQuestionsResult.rows[0].count);

      const session = sessionCheck.rows[0];

      // Update completion status
      if (userId === session.initiated_by) {
        await client.query(
          'UPDATE negotiation_sessions SET user1_completed = $1 WHERE id = $2',
          [answeredQuestions >= totalQuestions, id]
        );
      } else {
        await client.query(
          'UPDATE negotiation_sessions SET user2_completed = $1 WHERE id = $2',
          [answeredQuestions >= totalQuestions, id]
        );
      }

      // Check if both users completed and calculate match
      const completionCheck = await client.query(
        'SELECT user1_completed, user2_completed FROM negotiation_sessions WHERE id = $1',
        [id]
      );

      if (completionCheck.rows[0].user1_completed && completionCheck.rows[0].user2_completed) {
        // Calculate matches and gaps
        await calculateNegotiationMatch(client, id);
      }

      await client.query('COMMIT');

      res.status(201).json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error submitting answers:', error);
    res.status(500).json({ error: 'Failed to submit answers' });
  }
});

// PUT /api/negotiation/sessions/:id/schedule - Schedule a meeting
router.put('/sessions/:id/schedule', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = $1)',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = userResult.rows[0].id;
    const { id } = req.params;
    const { scheduled_meeting_at, meeting_notes } = req.body;

    // Check if user is part of this session
    const sessionCheck = await pool.query(
      'SELECT * FROM negotiation_sessions WHERE id = $1 AND (initiated_by = $2 OR with_user_id = $2)',
      [id, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const result = await pool.query(
      `UPDATE negotiation_sessions
      SET scheduled_meeting_at = COALESCE($2, scheduled_meeting_at),
          meeting_notes = COALESCE($3, meeting_notes),
          status = 'scheduled'
      WHERE id = $1
      RETURNING *`,
      [id, scheduled_meeting_at, meeting_notes]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    res.status(500).json({ error: 'Failed to schedule meeting' });
  }
});

// Helper function to calculate negotiation match
async function calculateNegotiationMatch(client: any, sessionId: string) {
  // Get session
  const sessionResult = await client.query(
    'SELECT * FROM negotiation_sessions WHERE id = $1',
    [sessionId]
  );

  if (sessionResult.rows.length === 0) return;

  const session = sessionResult.rows[0];
  const user1Id = session.initiated_by;
  const user2Id = session.with_user_id;

  // Get all answers grouped by question
  const answersResult = await client.query(
    `SELECT question_id, user_id, answer
    FROM negotiation_answers
    WHERE session_id = $1`,
    [sessionId]
  );

  // Group answers by question
  const answersByQuestion: any = {};
  answersResult.rows.forEach((row) => {
    if (!answersByQuestion[row.question_id]) {
      answersByQuestion[row.question_id] = {};
    }
    answersByQuestion[row.question_id][row.user_id] = row.answer;
  });

  // Calculate matches and gaps
  let matches = 0;
  let gaps = 0;
  const highlightedMatches: string[] = [];
  const potentialGaps: string[] = [];

  for (const [questionId, answers] of Object.entries(answersByQuestion)) {
    const user1Answer = (answers as any)[user1Id];
    const user2Answer = (answers as any)[user2Id];

    if (JSON.stringify(user1Answer) === JSON.stringify(user2Answer)) {
      matches++;
      highlightedMatches.push(`Question ${questionId}`);
    } else {
      gaps++;
      potentialGaps.push(`Question ${questionId}`);
    }
  }

  const totalQuestions = Object.keys(answersByQuestion).length;
  const matchScore = totalQuestions > 0 ? Math.round((matches / totalQuestions) * 100) : 0;

  // Update session
  await client.query(
    `UPDATE negotiation_sessions
    SET match_score = $1,
        highlighted_matches = $2,
        potential_gaps = $3,
        status = 'completed'
    WHERE id = $4`,
    [matchScore, highlightedMatches, potentialGaps, sessionId]
  );
}

export default router;
