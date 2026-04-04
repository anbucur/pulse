import dotenv from 'dotenv';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { Client as MinioClient } from 'minio';
import { MeiliSearch } from 'meilisearch';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'GEMINI_API_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}.\n` +
    'Please check your .env file and ensure all required variables are set.'
  );
}

// Warn if in development mode with production values
if (process.env.NODE_ENV === 'production') {
  const weakSecrets = [
    process.env.JWT_SECRET?.includes('change') || process.env.JWT_SECRET?.length < 32,
    process.env.MINIO_SECRET_KEY?.includes('change') || process.env.MINIO_SECRET_KEY?.length < 16,
  ];

  if (weakSecrets.some(Boolean)) {
    console.error('WARNING: Weak secrets detected in production. Please use strong, unique secrets.');
  }
}

// Database
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// MinIO
export const minioClient = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT?.replace('https://', '').replace('http://', '').split(':')[0] || 'localhost',
  port: parseInt(process.env.MINIO_ENDPOINT?.split(':')[1] || '9000'),
  useSSL: process.env.MINIO_ENDPOINT?.startsWith('https') || false,
  accessKey: process.env.MINIO_ACCESS_KEY!, // Required - validated above
  secretKey: process.env.MINIO_SECRET_KEY!, // Required - validated above
});

// Meilisearch
export const meilisearch = new MeiliSearch({
  host: process.env.MEILISEARCH_ENDPOINT || 'http://localhost:7700',
  apiKey: process.env.MEILISEARCH_API_KEY || '',
});

// JWT Config
export const jwtConfig = {
  secret: process.env.JWT_SECRET!, // Required - validated above
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
};

// VAPID Keys for Web Push
export const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY!, // Required - validated above
  privateKey: process.env.VAPID_PRIVATE_KEY!, // Required - validated above
};

// AI Config
export const aiConfig = {
  geminiApiKey: process.env.GEMINI_API_KEY!, // Required - validated above
};

// Initialize MinIO bucket
export async function initializeMinIO() {
  const bucket = process.env.MINIO_BUCKET || 'pulse';
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket);
    console.log(`MinIO bucket '${bucket}' created`);
  }
}

// Initialize Meilisearch indexes
export async function initializeMeilisearch() {
  try {
    // Create profiles index
    const profilesIndex = meilisearch.index('profiles');
    await profilesIndex.updateSettings({
      searchableAttributes: ['displayName', 'bio', 'interests', 'tags'],
      filterableAttributes: ['gender', 'age', 'sexualOrientation', 'intent', 'hasPhoto', 'isVerified'],
      sortableAttributes: ['createdAt'],
      rankingRules: ['proximity', 'words', 'typo', 'attribute', 'sort', 'exactness'],
    });
    console.log('Meilisearch indexes initialized');
  } catch (error) {
    console.error('Error initializing Meilisearch:', error);
  }
}
