import 'dotenv/config';
import express from 'express';
import { Worker } from 'bullmq';
import { Worker as ThreadWorker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { redisConnection } from './lib/redis.js';
import {
  incJobsProcessed,
  incJobErrors,
  recordProcessingTime,
  buildMetricsText,
} from './lib/metrics.js';
import { createRequire } from 'module';
import type { Redis as RedisType, RedisOptions } from 'ioredis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.WORKER_METRICS_PORT || 3003;
const JOB_TYPE = 'math-tasks';

//  BullMQ-dedicated IORedis instance

const require = createRequire(import.meta.url);
const RedisCtor = require('ioredis') as new (
  options?: string | number | RedisOptions,
  config?: RedisOptions
) => RedisType;

const bullRedis: RedisType = new RedisCtor(
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

const logTarget = process.env.REDIS_URL ? 'REDIS_URL config string' : `[${process.env.REDIS_HOST}]`;

// Track registered job types to avoid per-job sadd
const registeredJobTypes = new Set<string>([JOB_TYPE]);
await redisConnection.sadd('metrics:known_job_types', JOB_TYPE);

// CPU Thread Runner
function runCpuThread(scriptPath = '', limit = 100000): Promise<number> {
  return new Promise((resolve, reject) => {
    const thread = new ThreadWorker(path.resolve(__dirname, scriptPath), {
      workerData: { limit },
    });

    thread.on('message', (msg) => resolve(msg.result));
    thread.on('error', reject);
    thread.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Thread exited with code ${code}`));
    });
  });
}

//  BullMQ Worker
const queueWorker = new Worker(
  'math-tasks',
  async (job) => {
    console.warn(`[WORKER] Ingesting Job ${job.id} | Type: ${job.name}`);
    const startTime = performance.now();
    const limit = job.data.limit || 100000;

    try {
      if (!registeredJobTypes.has(job.name)) {
        registeredJobTypes.add(job.name);
        // Fire-and-forget: don't block the job on this bookkeeping write
        redisConnection
          .sadd('metrics:known_job_types', job.name)
          .catch((err) => console.warn('[WORKER] Failed to register job type:', err.message));
      }

      const result = await runCpuThread('./threads/prime.worker.js', limit);
      const durationSeconds = (performance.now() - startTime) / 1000;

      await Promise.all([
        incJobsProcessed(job.name),
        recordProcessingTime(job.name, durationSeconds),
      ]);

      return { success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown pipeline error';
      console.error(`[WORKER_ERROR] Job ${job.id} failed:`, errorMessage);
      // Fire-and-forget error metric: don't let a Redis hiccup swallow the real error
      incJobErrors(job.name).catch((err) =>
        console.warn('[WORKER] Failed to record error metric:', err.message)
      );
      throw error;
    }
  },
  {
    connection: bullRedis, // pass the instance, not a config object
    concurrency: 4,
    lockDuration: 120_000, // 2 min: covers worst-case CPU job duration
    lockRenewTime: 40_000, // renew at 1/3 of lockDuration
    stalledInterval: 120_000, // Match your lock duration so jobs aren't marked stalled too early
    maxStalledCount: 1,
  }
);

queueWorker.on('failed', (job, err) => {
  console.error(`[QUEUE] Job ${job?.id} permanently failed:`, err.message);
});

//  Express Server
const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', worker: 'active' });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.status(200).send(await buildMetricsText());
  } catch (err) {
    console.error('[METRICS_ENDPOINT_ERROR]', err);
    res.status(500).send('Error rendering metrics');
  }
});

app.listen(PORT, () => {
  console.warn(`[SYSTEM] Worker runtime actively listening on port ${PORT}`);
  console.warn(`[SYSTEM] Monitoring BullMQ queue targeting cluster Redis via ${logTarget}`);
});

//  Graceful Shutdown
const shutdown = async (signal = 'SIGTERM') => {
  console.warn(`[SHUTDOWN] Received ${signal}. Starting graceful cleanup...`);
  await queueWorker.close();
  console.warn('[SHUTDOWN] BullMQ worker closed.');
  await bullRedis.quit();
  console.warn('[SHUTDOWN] BullMQ Redis connection closed.');
  await redisConnection.quit();
  console.warn('[SHUTDOWN] Metrics Redis connection closed.');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
