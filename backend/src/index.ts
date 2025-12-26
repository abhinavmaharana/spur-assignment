import express from 'express';
import cors from 'cors';
import chatRoutes from './routes/chat';
import { initRedis, closeRedis } from './services/redis';
import { apiRateLimiter } from './middleware/rateLimit';
import prisma from './db/prisma';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
// CORS configuration - allow specific origins in production, all in development
const corsOptions = {
  origin: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map((origin: string) => origin.trim())
    : '*', // Allow all origins in development if not specified
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// Health check with detailed status (exempt from rate limiting by placing before rate limiter)
app.get('/health', async (req, res) => {
  try {
    const health: {
      status: string;
      database: string;
      redis?: string;
      timestamp: string;
    } = {
      status: 'ok',
      database: 'unknown',
      timestamp: new Date().toISOString(),
    };

    // Check database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.database = 'connected';
    } catch (error) {
      health.database = 'disconnected';
      health.status = 'degraded';
    }

    // Check Redis connectivity (if enabled)
    const { isRedisEnabled } = await import('./services/redis');
    if (isRedisEnabled()) {
      health.redis = 'enabled';
    } else {
      health.redis = 'disabled';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Apply general API rate limiting to all routes (after health check)
app.use(apiRateLimiter);

// Routes
app.use('/chat', chatRoutes);

// Error handling middleware (catches any unhandled errors)
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errorMessage = err instanceof Error ? err.message : 'Unknown error';
  const errorStack = err instanceof Error ? err.stack : undefined;
  console.error('Unhandled error:', errorMessage, errorStack);
  
  // Never expose stack traces or internal details
  res.status(500).json({
    error: 'Internal server error',
    message: 'Please try again shortly.',
  });
});

// Initialize Redis and start server
async function start() {
  try {
    // Initialize Redis (optional, continues if fails)
    await initRedis();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await closeRedis();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  await closeRedis();
  process.exit(0);
});

start();
