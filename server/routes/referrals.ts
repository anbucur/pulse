/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { pool } from '../config/index.js';
import crypto from 'crypto';

const router = express.Router();

// Generate unique referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous characters
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Middleware to verify JWT token
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    req.userId = result.rows[0].id;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token verification failed' });
  }
};

// Get or create user's referral code
router.get('/my-code', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM referral_codes WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      // Create new referral code
      let code = generateReferralCode();
      let attempts = 0;

      // Ensure uniqueness
      while (attempts < 10) {
        const existing = await pool.query('SELECT id FROM referral_codes WHERE code = $1', [code]);
        if (existing.rows.length === 0) break;
        code = generateReferralCode();
        attempts++;
      }

      const newCode = await pool.query(
        `INSERT INTO referral_codes (user_id, code, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '1 year')
         RETURNING *`,
        [req.userId, code]
      );

      return res.json(newCode.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching referral code:', error);
    res.status(500).json({ error: 'Failed to fetch referral code' });
  }
});

// Validate referral code
router.get('/validate/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const result = await pool.query(
      `SELECT rc.*, u.username, u.display_name
       FROM referral_codes rc
       JOIN users u ON rc.user_id = u.id
       WHERE rc.code = $1 AND rc.is_active = true AND (rc.expires_at IS NULL OR rc.expires_at > CURRENT_TIMESTAMP)`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired referral code' });
    }

    const codeData = result.rows[0];
    res.json({
      valid: true,
      referrer: {
        username: codeData.username,
        display_name: codeData.display_name
      },
      reward: {
        type: codeData.reward_type,
        amount: codeData.reward_amount
      }
    });
  } catch (error) {
    console.error('Error validating referral code:', error);
    res.status(500).json({ error: 'Failed to validate code' });
  }
});

// Apply referral code during signup
router.post('/apply', authenticateToken, async (req: any, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Referral code is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Validate code
    const codeResult = await client.query(
      `SELECT * FROM referral_codes
       WHERE code = $1 AND is_active = true
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       FOR UPDATE`,
      [code]
    );

    if (codeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invalid or expired referral code' });
    }

    const referralCode = codeResult.rows[0];

    // Check if user already has a referral
    const existingReferral = await client.query(
      'SELECT id FROM referrals WHERE referred_id = $1',
      [req.userId]
    );

    if (existingReferral.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already used a referral code' });
    }

    // Create referral record
    const referralResult = await client.query(
      `INSERT INTO referrals (referrer_id, referral_code_id, status)
       VALUES ($1, $2, 'completed')
       RETURNING *`,
      [referralCode.user_id, referralCode.id]
    );

    // Update referred_id
    await client.query(
      `UPDATE referrals SET referred_id = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [req.userId, referralResult.rows[0].id]
    );

    // Update usage count
    await client.query(
      `UPDATE referral_codes SET total_uses = total_uses + 1 WHERE id = $1`,
      [referralCode.id]
    );

    // Create reward for referrer
    await client.query(
      `INSERT INTO referral_rewards (user_id, referral_id, reward_type, reward_amount, status, expires_at)
       VALUES ($1, $2, $3, $4, 'available', CURRENT_TIMESTAMP + INTERVAL '90 days')`,
      [referralCode.user_id, referralResult.rows[0].id, referralCode.reward_type, referralCode.reward_amount]
    );

    // Give reward to new user too
    await client.query(
      `INSERT INTO referral_rewards (user_id, referral_id, reward_type, reward_amount, status, expires_at)
       VALUES ($1, $2, $3, $4, 'available', CURRENT_TIMESTAMP + INTERVAL '90 days')`,
      [req.userId, referralResult.rows[0].id, referralCode.reward_type, referralCode.reward_amount]
    );

    // Log event
    await client.query(
      `INSERT INTO referral_events (referral_id, event_type, event_data)
       VALUES ($1, 'signup_completed', $2)`,
      [referralResult.rows[0].id, JSON.stringify({ new_user_id: req.userId })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      reward: {
        type: referralCode.reward_type,
        amount: referralCode.reward_amount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying referral code:', error);
    res.status(500).json({ error: 'Failed to apply referral code' });
  } finally {
    client.release();
  }
});

// Get user's referrals
router.get('/my-referrals', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.username, u.display_name, u.profile_photo
       FROM referrals r
       LEFT JOIN users u ON r.referred_id = u.id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// Get user's rewards
router.get('/rewards', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM referral_rewards
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rewards:', error);
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});

// Claim/redeem a reward
router.post('/rewards/:rewardId/claim', authenticateToken, async (req: any, res) => {
  const { rewardId } = req.params;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const rewardResult = await client.query(
      `SELECT * FROM referral_rewards
       WHERE id = $1 AND user_id = $2 AND status = 'available'
       FOR UPDATE`,
      [rewardId, req.userId]
    );

    if (rewardResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reward not found or already claimed' });
    }

    const reward = rewardResult.rows[0];

    // Apply reward based on type
    if (reward.reward_type === 'premium_time') {
      // Add premium time
      await client.query(
        `INSERT INTO subscriptions (user_id, tier, status, start_date, end_date)
         VALUES ($1, 'premium', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 day' * $2)
         ON CONFLICT (user_id) DO UPDATE
         SET end_date = COALESCE(subscriptions.end_date, CURRENT_TIMESTAMP) + INTERVAL '1 day' * $2,
             tier = 'premium',
             updated_at = CURRENT_TIMESTAMP`,
        [req.userId, reward.reward_amount]
      );
    }

    // Mark reward as applied
    await client.query(
      `UPDATE referral_rewards SET status = 'applied', applied_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [rewardId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      reward_applied: {
        type: reward.reward_type,
        amount: reward.reward_amount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error claiming reward:', error);
    res.status(500).json({ error: 'Failed to claim reward' });
  } finally {
    client.release();
  }
});

// Get referral leaderboard
router.get('/leaderboard', async (req, res) => {
  const { limit = '50' } = req.query;

  try {
    const result = await pool.query(
      `SELECT
        rl.user_id,
        u.username,
        u.display_name,
        u.profile_photo,
        rl.total_referrals,
        rl.successful_referrals,
        rl.total_rewards_earned,
        rl.rank_position
       FROM referral_leaderboard rl
       JOIN users u ON rl.user_id = u.id
       ORDER BY rl.successful_referrals DESC, rl.created_at ASC
       LIMIT $1`,
      [parseInt(limit as string)]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get user's rank on leaderboard
router.get('/my-rank', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT
        rl.user_id,
        rl.total_referrals,
        rl.successful_referrals,
        rl.total_rewards_earned,
        rl.rank_position
       FROM referral_leaderboard rl
       WHERE rl.user_id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        total_referrals: 0,
        successful_referrals: 0,
        total_rewards_earned: 0,
        rank_position: null
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching rank:', error);
    res.status(500).json({ error: 'Failed to fetch rank' });
  }
});

// Share referral code (track share event)
router.post('/share', authenticateToken, async (req: any, res) => {
  const { platform } = req.body; // 'twitter', 'facebook', 'whatsapp', 'copy', etc.

  try {
    const codeResult = await pool.query(
      `SELECT id FROM referral_codes WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [req.userId]
    );

    if (codeResult.rows.length === 0) {
      return res.status(404).json({ error: 'No referral code found' });
    }

    // Create referral placeholder for tracking
    const referralResult = await pool.query(
      `INSERT INTO referrals (referrer_id, referral_code_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id`,
      [req.userId, codeResult.rows[0].id]
    );

    // Log share event
    await pool.query(
      `INSERT INTO referral_events (referral_id, event_type, event_data)
       VALUES ($1, 'code_shared', $2)`,
      [referralResult.rows[0].id, JSON.stringify({ platform })]
    );

    res.json({
      success: true,
      referral_id: referralResult.rows[0].id
    });
  } catch (error) {
    console.error('Error tracking share:', error);
    res.status(500).json({ error: 'Failed to track share' });
  }
});

export default router;
