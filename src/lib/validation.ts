// Allowed MIME types for user-uploaded media
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav'];

const MAX_IMAGE_SIZE_MB = 10;
const MAX_VIDEO_SIZE_MB = 50;
const MAX_AUDIO_SIZE_MB = 10;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateDisplayName(name: string): ValidationResult {
  if (!name.trim()) return { valid: false, error: 'Display name is required' };
  if (name.trim().length > 50) return { valid: false, error: 'Display name must be 50 characters or fewer' };
  return { valid: true };
}

export function validateAge(age: number | string): ValidationResult {
  const n = Number(age);
  if (!Number.isInteger(n)) return { valid: false, error: 'Age must be a whole number' };
  if (n < 18) return { valid: false, error: 'You must be 18 or older to use Pulse' };
  if (n > 120) return { valid: false, error: 'Please enter a valid age' };
  return { valid: true };
}

export function validateBio(bio: string): ValidationResult {
  if (bio.length > 500) return { valid: false, error: 'Bio must be 500 characters or fewer' };
  return { valid: true };
}

export function validateMessageText(text: string): ValidationResult {
  if (!text.trim()) return { valid: false, error: 'Message cannot be empty' };
  if (text.length > 1000) return { valid: false, error: 'Message must be 1000 characters or fewer' };
  return { valid: true };
}

export function validateImageFile(file: File): ValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}` };
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return { valid: false, error: `Image must be under ${MAX_IMAGE_SIZE_MB}MB` };
  }
  return { valid: true };
}

export function validateVideoFile(file: File): ValidationResult {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid file type. Allowed: ${ALLOWED_VIDEO_TYPES.join(', ')}` };
  }
  if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
    return { valid: false, error: `Video must be under ${MAX_VIDEO_SIZE_MB}MB` };
  }
  return { valid: true };
}

export function validateAudioFile(file: File): ValidationResult {
  if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid audio type` };
  }
  if (file.size > MAX_AUDIO_SIZE_MB * 1024 * 1024) {
    return { valid: false, error: `Audio must be under ${MAX_AUDIO_SIZE_MB}MB` };
  }
  return { valid: true };
}

export function validateMediaFile(file: File): ValidationResult {
  const allAllowed = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES];
  if (!allAllowed.includes(file.type)) {
    return { valid: false, error: 'File type not allowed. Only images, videos, and audio files are accepted.' };
  }
  if (ALLOWED_VIDEO_TYPES.includes(file.type)) return validateVideoFile(file);
  if (ALLOWED_AUDIO_TYPES.includes(file.type)) return validateAudioFile(file);
  return validateImageFile(file);
}

export function validateOnboardingForm(data: {
  displayName: string;
  age: number | string;
  bio: string;
}): ValidationResult {
  const nameCheck = validateDisplayName(data.displayName);
  if (!nameCheck.valid) return nameCheck;
  const ageCheck = validateAge(data.age);
  if (!ageCheck.valid) return ageCheck;
  const bioCheck = validateBio(data.bio);
  if (!bioCheck.valid) return bioCheck;
  return { valid: true };
}
