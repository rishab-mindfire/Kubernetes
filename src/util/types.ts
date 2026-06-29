import type { ConnectionOptions } from 'bullmq';
import { redisConnection } from '../lib/redis.js';

// redisConnection is an instance of Redis from ioredis
export const bullMqConnection = redisConnection as unknown as ConnectionOptions;

export interface QueueStats {
  completed: number;
  failed: number;
  waiting: number;
  active: number;
  delayed: number;
}
