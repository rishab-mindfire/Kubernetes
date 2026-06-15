import 'dotenv/config';
import { Redis } from 'ioredis';

// Construct the URL dynamically to handle the host override
let redisUrl = process.env.REDIS_URL || 'redis://:password123@localhost:6379';

// override to localhost if in development mode
if (process.env.NODE_ENV === 'development') {
  // Replace the host part 'redis' with 'localhost' in the connection string
  redisUrl = redisUrl.replace('@redis:', '@localhost:');
}

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});

redisConnection.on('error', (err) => {
  console.error('CRITICAL Redis Error:', err);
});

// a test command to see if it actually works
redisConnection
  .info()
  .then(() => {
    console.warn('Redis: INFO command successful - Connection verified!');
  })
  .catch((err) => {
    console.error('Redis: Connection failed during initial check:', err.message);
  });
