import { redisConnection } from './redis.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const bullMqConnection = redisConnection as any;
