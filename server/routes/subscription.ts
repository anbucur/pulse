/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { pool } from '../config/index.js';

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // For now, simple token verification
    // In production, verify JWT properly
    const result = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [token] // Simplified - use JWT verification
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

// Get user's subscription status
router.get('/status', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      // Create free tier subscription
      const newSub = await pool.query(
        `INSERT INTO subscriptions (user_id, tier, status) VALUES ($1, 'free', 'active') RETURNING *`,
        [req.userId]
      );
      return res.json(newSub.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// Get usage for a specific feature
router.get('/usage/:feature', authenticateToken, async (req: any, res) => {
  const { feature } = req.params;
  const today = new Date().toISOString().split('T')[0];

  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(count), 0) as usage_count FROM usage_tracking
       WHERE user_id = $1 AND feature_type = $2 AND usage_date = $3`,
      [req.userId, feature, today]
    );

    // Get feature limits
    const featureResult = await pool.query(
      'SELECT * FROM feature_gates WHERE feature_name = $1 AND is_active = true',
      [feature]
    );

    const featureGate = featureResult.rows[0] || { free_tier_limit: 0, premium_unlimited: false };
    const usageCount = parseInt(result.rows[0].usage_count);

    res.json({
      feature,
      usage: usageCount,
      limit: featureGate.free_tier_limit,
      remaining: Math.max(0, featureGate.free_tier_limit - usageCount),
      reset_date: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// Get all usage stats
router.get('/usage', authenticateToken, async (req: any, res) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    const result = await pool.query(
      `SELECT feature_type, COALESCE(SUM(count), 0) as usage_count
       FROM usage_tracking
       WHERE user_id = $1 AND usage_date = $2
       GROUP BY feature_type`,
      [req.userId, today]
    );

    const featureGates = await pool.query(
      'SELECT * FROM feature_gates WHERE is_active = true'
    );

    const usage = result.rows.reduce((acc: any, row: any) => {
      acc[row.feature_type] = parseInt(row.usage_count);
      return acc;
    }, {});

    const features = featureGates.rows.map((gate: any) => ({
      feature: gate.feature_name,
      usage: usage[gate.feature_name] || 0,
      limit: gate.free_tier_limit,
      remaining: Math.max(0, gate.free_tier_limit - (usage[gate.feature_name] || 0)),
      premium_unlimited: gate.premium_unlimited
    }));

    res.json({ features, usage });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
});

// Track feature usage
router.post('/track', authenticateToken, async (req: any, res) => {
  const { feature_type, count = 1 } = req.body;

  if (!feature_type) {
    return res.status(400).json({ error: 'feature_type is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if user is premium
    const subResult = await client.query(
      `SELECT tier FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );

    const isPremium = subResult.rows.length > 0 && subResult.rows[0].tier === 'premium';

    if (isPremium) {
      await client.query('COMMIT');
      return res.json({ allowed: true, is_premium: true });
    }

    // Check feature limits
    const today = new Date().toISOString().split('T')[0];
    const gateResult = await client.query(
      'SELECT free_tier_limit FROM feature_gates WHERE feature_name = $1 AND is_active = true',
      [feature_type]
    );

    const gate = gateResult.rows[0];
    if (!gate || gate.free_tier_limit === null) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid feature type' });
    }

    // Check current usage
    const usageResult = await client.query(
      `SELECT COALESCE(SUM(count), 0) as total FROM usage_tracking
       WHERE user_id = $1 AND feature_type = $2 AND usage_date = $3`,
      [req.userId, feature_type, today]
    );

    const currentUsage = parseInt(usageResult.rows[0].total);

    if (currentUsage >= gate.free_tier_limit) {
      await client.query('ROLLBACK');
      return res.json({
        allowed: false,
        is_premium: false,
        usage: currentUsage,
        limit: gate.free_tier_limit,
        message: `Daily limit reached for ${feature_type}`
      });
    }

    // Track usage
    await client.query(
      `INSERT INTO usage_tracking (user_id, feature_type, count, usage_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, feature_type, usage_date)
       DO UPDATE SET count = usage_tracking.count + $3`,
      [req.userId, feature_type, count, today]
    );

    await client.query('COMMIT');

    const newUsage = currentUsage + count;
    res.json({
      allowed: true,
      is_premium: false,
      usage: newUsage,
      limit: gate.free_tier_limit,
      remaining: gate.free_tier_limit - newUsage
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error tracking usage:', error);
    res.status(500).json({ error: 'Failed to track usage' });
  } finally {
    client.release();
  }
});

// Create premium subscription
router.post('/subscribe', authenticateToken, async (req: any, res) => {
  const { billing_provider, provider_subscription_id } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update existing subscription or create new one
    const existingSub = await client.query(
      `SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active' FOR UPDATE`,
      [req.userId]
    );

    if (existingSub.rows.length > 0) {
      // Upgrade to premium
      const result = await client.query(
        `UPDATE subscriptions
         SET tier = 'premium',
             billing_provider = $2,
             provider_subscription_id = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [billing_provider, provider_subscription_id, existingSub.rows[0].id]
      );

      // Log history
      await client.query(
        `INSERT INTO subscription_history (subscription_id, event_type, from_tier, to_tier)
         VALUES ($1, 'upgraded', 'free', 'premium')`,
        [existingSub.rows[0].id]
      );

      await client.query('COMMIT');
      return res.json(result.rows[0]);
    }

    // Create new premium subscription
    const result = await client.query(
      `INSERT INTO subscriptions (user_id, tier, status, billing_provider, provider_subscription_id)
       VALUES ($1, 'premium', 'active', $2, $3)
       RETURNING *`,
      [req.userId, billing_provider, provider_subscription_id]
    );

    // Log history
    await client.query(
      `INSERT INTO subscription_history (subscription_id, event_type, to_tier)
       VALUES ($1, 'created', 'premium')`,
      [result.rows[0].id]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  } finally {
    client.release();
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req: any, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE subscriptions
       SET status = 'cancelled',
           auto_renew = false,
           end_date = CURRENT_TIMESTAMP + INTERVAL '30 days',
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND tier = 'premium' AND status = 'active'
       RETURNING *`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No active premium subscription found' });
    }

    // Log history
    await client.query(
      `INSERT INTO subscription_history (subscription_id, event_type, from_tier, to_tier)
       VALUES ($1, 'cancelled', 'premium', 'free')`,
      [result.rows[0].id]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  } finally {
    client.release();
  }
});

// Webhook handler for billing providers (placeholder)
router.post('/webhook', async (req, res) => {
  const { provider, event_type, data } = req.body;

  // Placeholder for webhook handling
  // In production, verify webhook signatures and handle events appropriately
  console.log(`Webhook received from ${provider}:`, event_type);

  res.json({ received: true });
});

// Get subscription history
router.get('/history', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT sh.*, s.tier
       FROM subscription_history sh
       JOIN subscriptions s ON sh.subscription_id = s.id
       WHERE s.user_id = $1
       ORDER BY sh.created_at DESC
       LIMIT 50`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subscription history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
