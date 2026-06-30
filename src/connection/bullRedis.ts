import { createRequire } from 'module';
import type { Redis as RedisType, RedisOptions } from 'ioredis';

const require = createRequire(import.meta.url);
const RedisCtor = require('ioredis') as new (
  options?: string | number | RedisOptions,
  config?: RedisOptions
) => RedisType;

export const bullRedis: RedisType = new RedisCtor(
  process.env.REDIS_URL ?? process.env.REDIS_HOST ?? 'localhost',
  {
    connectTimeout: 15_000,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    keepAlive: 10_000,
    lazyConnect: false,
    retryStrategy: (times: number) => {
      if (times > 20) {
        console.error(`[REDIS] Giving up after ${times} retries`);
        return null;
      }
      const delay = Math.min(times * 250, 5_000);
      console.warn(`[REDIS] Retry #${times} in ${delay}ms`);
      return delay;
    },
  }
);

bullRedis.on('error', (err: Error) => console.error('[REDIS_BULL] Connection error:', err.message));
bullRedis.on('connect', () => console.warn('[REDIS_BULL] Connected to Redis'));
bullRedis.on('reconnecting', () => console.warn('[REDIS_BULL] Reconnecting...'));

export const logTarget = process.env.REDIS_URL
  ? 'REDIS_URL config string'
  : `[${process.env.REDIS_HOST}]`;
