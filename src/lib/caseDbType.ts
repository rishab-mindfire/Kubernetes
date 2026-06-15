import { redisConnection } from './redis.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const bullMqConnection: any = redisConnection;

// Optional: Add a helper to check if Redis is ready
export const isRedisReady = (): boolean => {
  return redisConnection.status === 'ready';
};
