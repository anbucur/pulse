import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { pool } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// Get all notifications for current user
router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const { limit = 50, offset = 0, unread_only = false } = req.query;

  let query = `
    SELECT * FROM notifications
    WHERE user_id = $1
  `;
  const params: any[] = [req.userId];

  if (unread_only === 'true') {
    query += ` AND is_read = false`;
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(parseInt(limit as string), parseInt(offset as string));

  const result = await pool.query(query, params);

  // Get unread count
  const unreadResult = await pool.query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
    [req.userId]
  );

  res.json({
    notifications: result.rows,
    unread_count: parseInt(unreadResult.rows[0].count),
    total: result.rows.length,
  });
}));

// Get unread count
router.get('/unread-count', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
    [req.userId]
  );

  res.json({ count: parseInt(result.rows[0].count) });
}));

// Mark notification as read
router.post('/:id/read', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, req.userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Notification not found', 404);
  }

  res.json(result.rows[0]);
}));

// Mark all notifications as read
router.post('/read-all', asyncHandler(async (req: AuthRequest, res) => {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
    [req.userId]
  );

  res.json({ message: 'All notifications marked as read' });
}));

// Delete a notification
router.delete('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Notification not found', 404);
  }

  res.json({ deleted: true });
}));

// Helper: Create a notification (used internally by other routes)
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, body, JSON.stringify(data)]
    );
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

export default router;
