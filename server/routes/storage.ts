import { Router } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { minioClient } from '../config/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';
import { upload, sanitizeFilename, getFileCategory, MAX_FILE_SIZE } from '../utils/fileValidation.js';

const router = Router();

// All storage routes require authentication
router.use(authenticate);

// Upload file
router.post('/upload', upload.single('file'), asyncHandler(async (req: AuthRequest, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const { folder = 'uploads', isPublic = 'true', metadata } = req.body;
  const bucket = process.env.MINIO_BUCKET || 'pulse';

  // Sanitize folder name to prevent path traversal
  const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '_') || 'uploads';

  // Sanitize filename
  const fileExtension = req.file.originalname.split('.').pop() || 'bin';
  const sanitizedFilename = sanitizeFilename(req.file.originalname);

  // Generate unique key
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const key = `${sanitizedFolder}/${req.userId}/${uniqueId}.${fileExtension}`;

  // Validate file size
  const category = getFileCategory(req.file.mimetype);
  if (category) {
    const maxSize = MAX_FILE_SIZE[category];
    if (req.file.size > maxSize) {
      throw new AppError(
        `File size ${Math.round(req.file.size / 1024 / 1024)}MB exceeds maximum ${Math.round(maxSize / 1024 / 1024)}MB for ${category} files`,
        400
      );
    }
  }

  // Upload to MinIO
  await minioClient.putObject(bucket, key, req.file.buffer, {
    'Content-Type': req.file.mimetype,
    'Content-Length': req.file.size.toString(),
  });

  // Generate URL
  const url = `${process.env.MINIO_ENDPOINT}/${bucket}/${key}`;

  res.json({
    url,
    key,
    size: req.file.size,
    contentType: req.file.mimetype,
    filename: sanitizedFilename,
  });
}));

// Delete file
router.delete('/delete/:key(*)', asyncHandler(async (req: AuthRequest, res) => {
  const { key } = req.params;
  const bucket = process.env.MINIO_BUCKET || 'pulse';

  // Verify user owns this file (key should contain userId)
  if (!key.includes(req.userId)) {
    throw new AppError('Unauthorized to delete this file', 403);
  }

  await minioClient.removeObject(bucket, key);

  res.json({ message: 'File deleted' });
}));

// Get presigned URL (for private files)
router.get('/presigned/:key(*)', asyncHandler(async (req: AuthRequest, res) => {
  const { key } = req.params;
  const { expiresIn = '3600' } = req.query;
  const bucket = process.env.MINIO_BUCKET || 'pulse';

  // Verify user owns this file
  if (!key.includes(req.userId)) {
    throw new AppError('Unauthorized to access this file', 403);
  }

  const url = await minioClient.presignedGetObject(
    bucket,
    key,
    parseInt(expiresIn as string)
  );

  res.json({ url });
}));

export default router;
