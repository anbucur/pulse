import { Router } from 'express';
import { messageValidation, validate } from '../middleware/validate.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { pool, redis } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// Create chat room
router.post('/rooms', asyncHandler(async (req: AuthRequest, res) => {
  const { participants } = req.body;

  if (!participants || !Array.isArray(participants)) {
    throw new AppError('Participants array is required', 400);
  }

  if (!participants.includes(req.userId)) {
    participants.push(req.userId);
  }

  // Sort to ensure consistent room ID
  participants.sort();

  // Check if room already exists
  const existing = await pool.query(
    `SELECT * FROM chat_rooms
     WHERE participants = $1::uuid[]`,
    [participants]
  );

  if (existing.rows.length > 0) {
    return res.json(existing.rows[0]);
  }

  // Create new room
  const result = await pool.query(
    `INSERT INTO chat_rooms (participants, created_by)
     VALUES ($1, $2)
     RETURNING *`,
    [participants, req.userId]
  );

  res.json(result.rows[0]);
}));

// Get user's chat rooms
router.get('/rooms', asyncHandler(async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT cr.*,
      ARRAY(
        SELECT json_build_object('userId', u.id, 'displayName', p.display_name, 'photo', p.photos[1])
        FROM users u
        JOIN profiles p ON p.user_id = u.id
        WHERE u.id = ANY(cr.participants) AND u.id != $1
      ) as other_users
     FROM chat_rooms cr
     WHERE $1 = ANY(cr.participants)
     ORDER BY cr.last_message_at DESC NULLS LAST`,
    [req.userId]
  );

  res.json(result.rows);
}));

// Get chat room by ID
router.get('/rooms/:roomId', asyncHandler(async (req: AuthRequest, res) => {
  const { roomId } = req.params;

  const result = await pool.query(
    'SELECT * FROM chat_rooms WHERE id = $1',
    [roomId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Chat room not found', 404);
  }

  if (!result.rows[0].participants.includes(req.userId)) {
    throw new AppError('Not a participant in this room', 403);
  }

  res.json(result.rows[0]);
}));

// Get messages for a room
router.get('/rooms/:roomId/messages', asyncHandler(async (req: AuthRequest, res) => {
  const { roomId } = req.params;
  const { limit = 50, before } = req.query;

  // Verify participation
  const room = await pool.query(
    'SELECT * FROM chat_rooms WHERE id = $1',
    [roomId]
  );

  if (room.rows.length === 0 || !room.rows[0].participants.includes(req.userId)) {
    throw new AppError('Not a participant in this room', 403);
  }

  let query = `
    SELECT cm.*, u.display_name as sender_name
    FROM chat_messages cm
    JOIN users u ON u.id = cm.sender_id
    WHERE cm.room_id = $1 AND cm.deleted_at IS NULL
  `;

  const params: any[] = [roomId];

  if (before) {
    query += ` AND cm.created_at < $2`;
    params.push(before);
  }

  query += ` ORDER BY cm.created_at DESC LIMIT $${params.length + 1}`;
  params.push(parseInt(limit as string));

  const result = await pool.query(query, params);

  res.json({ messages: result.rows.reverse() });
}));

// Send message
router.post('/rooms/:roomId/messages', validate(messageValidation), asyncHandler(async (req: AuthRequest, res) => {
  const { roomId } = req.params;
  const { text, mediaUrl, mediaType, isViewOnce, replyTo } = req.body;

  // Verify participation
  const room = await pool.query(
    'SELECT * FROM chat_rooms WHERE id = $1',
    [roomId]
  );

  if (room.rows.length === 0 || !room.rows[0].participants.includes(req.userId)) {
    throw new AppError('Not a participant in this room', 403);
  }

  const result = await pool.query(
    `INSERT INTO chat_messages (room_id, sender_id, text, media_url, media_type, is_view_once, reply_to)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [roomId, req.userId, text, mediaUrl, mediaType, isViewOnce || false, replyTo]
  );

  const message = result.rows[0];

  // Update room's last_message_at
  await pool.query(
    `UPDATE chat_rooms
     SET last_message_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [roomId]
  );

  // Increment unread counts for other participants
  const otherParticipants = room.rows[0].participants.filter((id: string) => id !== req.userId);
  for (const participantId of otherParticipants) {
    await pool.query(
      `UPDATE chat_rooms
       SET unread_counts = jsonb_set(
         COALESCE(unread_counts, '{}'::jsonb),
         $1,
         COALESCE((unread_counts->>$1)::int + 1, 1)
       )
       WHERE id = $2`,
      [participantId, roomId]
    );
  }

  // Emit via WebSocket (handled by WebSocket handler)

  res.json(message);
}));

// Mark messages as read
router.post('/rooms/:roomId/read', asyncHandler(async (req: AuthRequest, res) => {
  const { roomId } = req.params;

  // Mark all unread messages as read
  await pool.query(
    `UPDATE chat_messages
     SET is_read = true,
         read_by = array_append(COALESCE(read_by, '{}'), $1)
     WHERE room_id = $2
       AND sender_id != $1
       AND is_read = false`,
    [req.userId, roomId]
  );

  // Reset unread count
  await pool.query(
    `UPDATE chat_rooms
     SET unread_counts = jsonb_set(unread_counts, $1, '0')
     WHERE id = $2`,
    [req.userId, roomId]
  );

  res.json({ message: 'Messages marked as read' });
}));

// Delete message
router.delete('/rooms/:roomId/messages/:messageId', asyncHandler(async (req: AuthRequest, res) => {
  const { roomId, messageId } = req.params;

  // Verify ownership
  const message = await pool.query(
    'SELECT * FROM chat_messages WHERE id = $1 AND room_id = $2',
    [messageId, roomId]
  );

  if (message.rows.length === 0) {
    throw new AppError('Message not found', 404);
  }

  if (message.rows[0].sender_id !== req.userId) {
    throw new AppError('Not authorized to delete this message', 403);
  }

  await pool.query(
    `UPDATE chat_messages
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [messageId]
  );

  res.json({ message: 'Message deleted' });
}));

// Send typing indicator
router.post('/rooms/:roomId/typing', asyncHandler(async (req: AuthRequest, res) => {
  const { roomId } = req.params;
  const { isTyping = true } = req.body;

  // Update typing status in Redis (for real-time)
  await redis.setex(
    `typing:${roomId}:${req.userId}`,
    5, // 5 second expiration
    JSON.stringify({ userId: req.userId, isTyping })
  );

  res.json({ message: 'Typing status updated' });
}));

export default router;
