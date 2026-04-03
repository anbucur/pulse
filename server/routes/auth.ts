import { Router } from 'express';
import { registerValidation, loginValidation, validate } from '../middleware/validate.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { hashPassword, comparePassword, generateToken, verifyToken, sanitizeUser } from '../utils/helpers.js';
import { pool, redis } from '../config/index.js';

const router = Router();

// Register
router.post('/register', validate(registerValidation), asyncHandler(async (req, res) => {
  const { email, password, displayName } = req.body;

  // Check if user exists
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (existingUser.rows.length > 0) {
    throw new AppError('User already exists', 400, 'USER_EXISTS');
  }

  // Create user
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [email.toLowerCase(), passwordHash, displayName || email.split('@')[0]]
  );

  const user = result.rows[0];

  // Create empty profile
  await pool.query(
    `INSERT INTO profiles (user_id, display_name)
     VALUES ($1, $2)`,
    [user.id, displayName || email.split('@')[0]]
  );

  const { token, refreshToken } = generateToken(user.id);

  // Store refresh token in Redis
  await redis.set(`refresh:${user.id}`, refreshToken, 'EX', 30 * 24 * 60 * 60);

  res.status(201).json({
    user: sanitizeUser(user),
    token,
    refreshToken,
  });
}));

// Login
router.post('/login', validate(loginValidation), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  const user = result.rows[0];
  const isValid = await comparePassword(password, user.password_hash);

  if (!isValid) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  // Update last login
  await pool.query(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  const { token, refreshToken } = generateToken(user.id);

  // Store refresh token in Redis
  await redis.set(`refresh:${user.id}`, refreshToken, 'EX', 30 * 24 * 60 * 60);

  res.json({
    user: sanitizeUser(user),
    token,
    refreshToken,
  });
}));

// Verify Token
router.post('/verify', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('No token provided', 401);
  }

  const token = authHeader.substring(7);
  const { userId } = verifyToken(token);

  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  res.json({ user: sanitizeUser(result.rows[0]) });
}));

// Refresh Token
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token required', 400);
  }

  const decoded = verifyToken(refreshToken);
  if ((decoded as any).type !== 'refresh') {
    throw new AppError('Invalid refresh token', 401);
  }

  // Check if refresh token exists in Redis
  const storedToken = await redis.get(`refresh:${decoded.userId}`);
  if (storedToken !== refreshToken) {
    throw new AppError('Invalid refresh token', 401);
  }

  const { token, refreshToken: newRefreshToken } = generateToken(decoded.userId);

  // Update refresh token in Redis
  await redis.set(`refresh:${decoded.userId}`, newRefreshToken, 'EX', 30 * 24 * 60 * 60);

  res.json({ token, refreshToken: newRefreshToken });
}));

// Reset Password (request)
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  const result = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    // Don't reveal if user exists
    return res.json({ message: 'If user exists, password reset email sent' });
  }

  // Generate reset token
  const resetToken = generateToken(result.rows[0].id).token;
  await redis.set(`reset:${result.rows[0].id}`, resetToken, 'EX', 3600); // 1 hour

  // In production, send email here
  console.log(`Password reset for ${email}: ${resetToken}`);

  res.json({ message: 'If user exists, password reset email sent' });
}));

// Change Password
router.post('/change-password', asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.userId;

  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const user = result.rows[0];
  const isValid = await comparePassword(oldPassword, user.password_hash);

  if (!isValid) {
    throw new AppError('Invalid current password', 401);
  }

  const passwordHash = await hashPassword(newPassword);
  await pool.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [passwordHash, userId]
  );

  res.json({ message: 'Password changed successfully' });
}));

// Logout
router.post('/logout', asyncHandler(async (req, res) => {
  const userId = req.userId;

  // Remove refresh token from Redis
  await redis.del(`refresh:${userId}`);

  res.json({ message: 'Logged out successfully' });
}));

export default router;
