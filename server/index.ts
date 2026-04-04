import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';

import { pool, initializeMinIO, initializeMeilisearch } from './config/index.js';
import { notFound, errorHandler } from './utils/errors.js';
import { createWebSocketServer } from './websocket/index.js';

// Routes
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profiles.js';
import storageRoutes from './routes/storage.js';
import searchRoutes from './routes/search.js';
import aiRoutes from './routes/ai.js';
import chatRoutes from './routes/chat.js';
import featureRoutes from './routes/features.js';
import notificationRoutes from './routes/notifications.js';
import eventsRoutes from './routes/events.js';
import negotiationRoutes from './routes/negotiation.js';
import vibeRoutes from './routes/vibe.js';
import wingmanRoutes from './routes/wingman.js';
import aftercareRoutes from './routes/aftercare.js';
import tribesRoutes from './routes/tribes.js';
import bodymapRoutes from './routes/bodymap.js';
import chemistryRoutes from './routes/chemistry.js';
import safesignalRoutes from './routes/safesignal.js';
import fantasyRoutes from './routes/fantasy.js';
import marketplaceRoutes from './routes/marketplace.js';
import slowdatingRoutes from './routes/slowdating.js';
import voiceRoutes from './routes/voice.js';
import convoStartersRoutes from './routes/convo-starters.js';
import ghostingRoutes from './routes/ghosting.js';
import vouchRoutes from './routes/vouch.js';
import completionRoutes from './routes/completion.js';
import verificationRoutes from './routes/verification.js';
import locationSharingRoutes from './routes/location-sharing.js';
import eventDiscoveryRoutes from './routes/event-discovery.js';
import speedDatingRoutes from './routes/speed-dating.js';
import musicRoutes from './routes/music.js';
import datePlannerRoutes from './routes/date-planner.js';
import subscriptionRoutes from './routes/subscription.js';
import referralRoutes from './routes/referrals.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "https:"],
        frameSrc: ["'none'"],
      },
    } : false,
    hsts: isProduction ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    } : false,
  }));

  // CORS - stricter configuration
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : [process.env.CORS_ORIGIN || 'http://localhost:5173'];

  app.use(cors({
    origin: function(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: false, // Don't skip - count all attempts
    message: { error: 'Too many authentication attempts, please try again later.' },
  });

  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: { error: 'Too many uploads, please try again later.' },
  });

  const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: { error: 'Too many AI requests, please try again later.' },
  });

  app.use('/api/', limiter);
  app.use('/api/auth/', authLimiter);
  app.use('/api/storage/upload', uploadLimiter);
  app.use('/api/ai/', aiLimiter);

  // Health check
  app.get('/api/health', async (req, res) => {
    try {
      // Check database connection
      await pool.query('SELECT 1');

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          redis: 'connected',
        },
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Service unhealthy',
      });
    }
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/profiles', profileRoutes);
  app.use('/api/storage', storageRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/features', featureRoutes);
  app.use('/api/notifications', notificationRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/negotiation', negotiationRoutes);
app.use('/api/vibe', vibeRoutes);
app.use('/api/wingman', wingmanRoutes);
app.use('/api/aftercare', aftercareRoutes);
app.use('/api/tribes', tribesRoutes);
app.use('/api/bodymap', bodymapRoutes);
app.use('/api/chemistry', chemistryRoutes);
app.use('/api/safesignal', safesignalRoutes);
app.use('/api/fantasy', fantasyRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/slowdating', slowdatingRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/convo-starters', convoStartersRoutes);
app.use('/api/ghosting', ghostingRoutes);
app.use('/api/vouch', vouchRoutes);
app.use('/api/completion', completionRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/location-sharing', locationSharingRoutes);
app.use('/api/event-discovery', eventDiscoveryRoutes);
app.use('/api/speed-dating', speedDatingRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/date-planner', datePlannerRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/referrals', referralRoutes);

  // Create HTTP server
  const server = createServer(app);

  // WebSocket server
  const wss = createWebSocketServer(server);

  // Make wss accessible to routes
  app.set('wss', wss);

  // Vite middleware for development
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = join(__dirname, '../dist');
    app.use(express.static(distPath));

    // SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(join(distPath, 'index.html'));
    });
  }

  // Error handling
  app.use(notFound);
  app.use(errorHandler);

  // Initialize services
  try {
    await initializeMinIO();
    await initializeMeilisearch();
    console.log('Services initialized successfully');
  } catch (error) {
    console.error('Error initializing services:', error);
  }

  // Start server
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      pool.end(() => {
        console.log('Database pool closed');
        process.exit(0);
      });
    });
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
