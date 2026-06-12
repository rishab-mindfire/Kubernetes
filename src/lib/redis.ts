import 'dotenv/config';
import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || '';

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  // Enable reconnection
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisConnection.on('error', (err) => {
  console.error('Redis: Connection Error:', err.message);
});

// Event listeners to handle connection states
redisConnection.on('connect', () => {
  console.warn('Redis: Successfully connected to the server.');
});

redisConnection.on('ready', () => {
  console.warn('Redis: Connection is ready for commands.');
});

redisConnection.on('error', (err) => {
  console.error('Redis: Connection Error:', err.message);
});

redisConnection.on('close', () => {
  console.warn('Redis: Connection closed.');
});

redisConnection.on('reconnecting', () => {
  console.warn('Redis: Attempting to reconnect...');
});
