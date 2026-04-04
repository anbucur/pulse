import { Request } from 'express';
import multer from 'multer';

// Maximum file sizes (in bytes)
export const MAX_FILE_SIZE = {
  image: 10 * 1024 * 1024, // 10MB
  audio: 50 * 1024 * 1024, // 50MB
  video: 100 * 1024 * 1024, // 100MB
  document: 5 * 1024 * 1024, // 5MB
};

// Allowed MIME types by category
export const ALLOWED_MIME_TYPES = {
  image: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
  ],
  audio: [
    'audio/webm',
    'audio/ogg',
    'audio/wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
  ],
  video: [
    'video/webm',
    'video/ogg',
    'video/mp4',
    'video/mpeg',
  ],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

// Magic numbers (file signatures) for validation
export const MAGIC_NUMBERS: Record<string, Buffer> = {
  'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  'image/webp': Buffer.from([0x52, 0x49, 0x46, 0x46]),
  'image/gif': Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
  'audio/webm': Buffer.from([0x1A, 0x45, 0xDF, 0xA3]),
  'audio/wav': Buffer.from([0x52, 0x49, 0x46, 0x46]),
  'video/webm': Buffer.from([0x1A, 0x45, 0xDF, 0xA3]),
  'video/mp4': Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
  'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]),
};

/**
 * Validate file type by checking magic numbers
 */
export function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  const expectedSignature = MAGIC_NUMBERS[mimeType];
  if (!expectedSignature) {
    // If no magic number defined for this type, allow it
    return true;
  }

  // Check if the buffer starts with the expected signature
  return buffer.subarray(0, expectedSignature.length).equals(expectedSignature);
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove any directory components
  const sanitized = filename.replace(/^.*[\\\/]/, '');

  // Remove any non-alphanumeric characters except dots, underscores, and hyphens
  return sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Get file category from MIME type
 */
export function getFileCategory(mimeType: string): keyof typeof MAX_FILE_SIZE | null {
  if (ALLOWED_MIME_TYPES.image.includes(mimeType)) return 'image';
  if (ALLOWED_MIME_TYPES.audio.includes(mimeType)) return 'audio';
  if (ALLOWED_MIME_TYPES.video.includes(mimeType)) return 'video';
  if (ALLOWED_MIME_TYPES.document.includes(mimeType)) return 'document';
  return null;
}

/**
 * Multer file filter with validation
 */
export const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) => {
  // Check if MIME type is allowed
  const allAllowedTypes = [
    ...ALLOWED_MIME_TYPES.image,
    ...ALLOWED_MIME_TYPES.audio,
    ...ALLOWED_MIME_TYPES.video,
    ...ALLOWED_MIME_TYPES.document,
  ];

  if (!allAllowedTypes.includes(file.mimetype)) {
    return callback(new Error(`File type ${file.mimetype} is not allowed`));
  }

  // Validate file signature for supported types
  if (file.buffer && MAGIC_NUMBERS[file.mimetype]) {
    if (!validateFileSignature(file.buffer, file.mimetype)) {
      return callback(new Error('File content does not match the declared type'));
    }
  }

  callback(null, true);
};

/**
 * Configure multer with validation
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE.image, // Default to image size limit
    files: 1, // Only one file at a time
  },
  fileFilter,
});

/**
 * Validate upload with category-specific limits
 */
export function validateUpload(category: keyof typeof MAX_FILE_SIZE = 'image') {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FILE_SIZE[category],
      files: 1,
    },
    fileFilter,
  });
}
