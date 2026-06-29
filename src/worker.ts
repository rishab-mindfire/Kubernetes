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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.WORKER_METRICS_PORT || 3003;
const JOB_TYPE = 'math-tasks';

await redisConnection.sadd('metrics:known_job_types', JOB_TYPE);

// Connection Parser
const connectionOptions = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : { host: process.env.REDIS_HOST };

const logTarget = process.env.REDIS_URL ? 'REDIS_URL config string' : `[${connectionOptions.host}]`;

// Background CPU Work Orchestrator
function runCpuThread(scriptPath = '', limit = 100000) {
  return new Promise((resolve, reject) => {
    const thread = new ThreadWorker(path.resolve(__dirname, scriptPath), {
      workerData: { limit },
    });

    thread.on('message', (msg) => resolve(msg.result));
    thread.on('error', reject);
    thread.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Thread processing failed with exit code ${code}`));
    });
  });
}

// BullMQ Queue Consumer
const queueWorker = new Worker(
  'math-tasks',
  async (job) => {
    console.warn(`[WORKER] Ingesting Job ${job.id} | Type: ${job.name}`);

    const startTime = performance.now();
    const limit = job.data.limit || 100000;

    try {
      // Log the tracking state to the known job types set dynamically
      await redisConnection.sadd('metrics:known_job_types', job.name);

      // Route processing tasks straight into the background worker thread
      const result = await runCpuThread('./thread/prime.worker.js', limit);
      const durationSeconds = (performance.now() - startTime) / 1000;

      // Atomically pipeline success records directly to your custom metrics engine
      await incJobsProcessed(job.name);
      await recordProcessingTime(job.name, durationSeconds);

      return { success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown pipeline error';
      console.error(`[WORKER_ERROR] Job ${job.id} breached execution limits:`, errorMessage);

      // Update job failure name counter dynamically in Redis
      await incJobErrors(job.name);

      // Rethrow to allow BullMQ to handle proper retry intervals
      throw error;
    }
  },
  {
    connection: connectionOptions,
    concurrency: 4,
  }
);

// Server
const app = express();

// Simple health probe
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', worker: 'active' });
});

// Expose standard /metrics endpoint for Prometheus scraping
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4');
    const metricsText = await buildMetricsText();
    res.status(200).send(metricsText);
  } catch (err) {
    console.error('[METRICS_ENDPOINT_ERROR]', err);
    res.status(500).send('Error rendering metrics');
  }
});

app.listen(PORT, () => {
  console.warn(`[SYSTEM] Worker runtime actively listening on port ${PORT}`);
  console.warn(`[SYSTEM] Monitoring BullMQ queue targeting cluster Redis via ${logTarget}`);
});

//KUBERNETES SIGTERM GRACEFUL SHUTDOWN
const shutdown = async (signal = 'SIGTERM') => {
  console.warn(`[SHUTDOWN] Received ${signal}. Starting graceful cleanup sequence...`);
  await queueWorker.close();
  console.warn('[SHUTDOWN] BullMQ listener successfully closed.');
  await redisConnection.quit();
  console.warn('[SHUTDOWN] Disconnected from Redis cluster network cleanly.');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
