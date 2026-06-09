import { Redis } from 'ioredis';

// Use a shared connection instance
export const redisConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});
