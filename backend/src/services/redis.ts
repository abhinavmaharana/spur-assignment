import Redis from 'ioredis';

let redis: Redis | null = null;
let redisEnabled = false;

export async function initRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.log('Redis: REDIS_URL not set, operating without cache');
    return;
  }

  try {
    redis = new Redis(redisUrl, {
      retryStrategy: () => null, // Disable automatic retries completely
      maxRetriesPerRequest: null, // Disable retries per request
      enableOfflineQueue: false, // Don't queue commands when offline
      lazyConnect: true,
      connectTimeout: 3000, // 3 second timeout
      enableReadyCheck: false, // Don't wait for ready check
      showFriendlyErrorStack: false,
    });

    // Handle ALL error events BEFORE attempting to connect
    redis.on('error', () => {
      // Silently handle - Redis is optional
      redisEnabled = false;
    });

    redis.on('close', () => {
      redisEnabled = false;
    });

    // Attempt to connect with a timeout
    await Promise.race([
      redis.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 3000)
      )
    ]).catch(() => {
      throw new Error('Connection failed');
    });

    // Verify connection by pinging with timeout
    await Promise.race([
      redis.ping(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Ping timeout')), 2000)
      )
    ]);

    redisEnabled = true;
    console.log('Redis: Connected successfully');
  } catch (error: unknown) {
    // Clean up and disable Redis
    if (redis) {
      try {
        // Remove all listeners to prevent further errors
        redis.removeAllListeners();
        redis.disconnect(false); // Force disconnect
      } catch (e) {
        // Ignore disconnect errors
      }
      redis = null;
    }
    redisEnabled = false;
    // Don't log error - Redis is optional, operate silently without it
  }
}

export async function getCachedMessages(
  conversationId: string
): Promise<Array<{ sender: string; text: string }> | null> {
  if (!redisEnabled || !redis) {
    return null;
  }

  try {
    const cached = await redis.get(`conv:${conversationId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Array<{ sender: string; text: string }>;
        // Validate structure
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (parseError) {
        console.warn('Redis: Error parsing cached messages:', parseError);
        // Invalid cache data, return null to fetch from DB
        return null;
      }
    }
  } catch (error) {
    console.warn('Redis: Error reading cache:', error);
  }

  return null;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
      redis = null;
      redisEnabled = false;
    } catch (error) {
      console.warn('Redis: Error closing connection:', error);
    }
  }
}

export async function cacheMessages(
  conversationId: string,
  messages: Array<{ sender: string; text: string }>
): Promise<void> {
  if (!redisEnabled || !redis) {
    return;
  }

  try {
    // Cache last 20 messages
    const toCache = messages.slice(-20);
    await redis.setex(
      `conv:${conversationId}`,
      3600, // 1 hour TTL
      JSON.stringify(toCache)
    );
  } catch (error) {
    console.warn('Redis: Error caching messages:', error);
    // Continue execution even if cache fails
  }
}

export function isRedisEnabled(): boolean {
  return redisEnabled;
}
