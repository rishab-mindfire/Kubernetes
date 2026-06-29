import client from 'prom-client';
import { type Express } from 'express';
import { redisConnection } from './redis.js';

// Reference global Prometheus registry
const register = client.register;

// Initialize default Node system collectors (CPU, Memory, Event Loop)
client.collectDefaultMetrics({
  register,
  prefix: 'node_',
});

// Define latency/performance distribution buckets
export const BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

// --- Redis-backed Metric Helpers ---
export async function incJobsProcessed(jobType: string): Promise<void> {
  await redisConnection.incr(`metrics:jobs_processed_total:${jobType}`);
}

export async function incJobErrors(jobType: string): Promise<void> {
  await redisConnection.incr(`metrics:job_errors_total:${jobType}`);
}

export async function recordProcessingTime(
  jobType: string,
  durationSeconds: number
): Promise<void> {
  const pipeline = redisConnection.pipeline();
  pipeline.incrbyfloat(`metrics:job_processing_time_seconds_sum:${jobType}`, durationSeconds);
  pipeline.incr(`metrics:job_processing_time_seconds_count:${jobType}`);

  for (const le of BUCKETS) {
    if (durationSeconds <= le) {
      pipeline.incr(`metrics:job_processing_time_seconds_bucket:${le}:${jobType}`);
    }
  }
  pipeline.incr(`metrics:job_processing_time_seconds_bucket:+Inf:${jobType}`);
  await pipeline.exec();
}

/**
 * Utility helper to safely pull and cast a numeric string from Redis
 */
export async function redisNum(key = '') {
  const value = await redisConnection.get(key);
  return value ? parseInt(value, 10) : 0;
}

/**
 * Fetches all active job names recorded in our shared tracking set
 */
export async function getJobTypes() {
  return await redisConnection.smembers('metrics:known_job_types');
}

/**
 * Increments the submission tracking counter inside Redis for a specific job name
 */
export async function incJobsSubmitted(jobType = '') {
  if (!jobType) return;
  await redisConnection.sadd('metrics:known_job_types', jobType);
  await redisConnection.incr(`metrics:jobs_submitted_total:${jobType}`);
}

/**
 * Compiles system runtime parameters and Redis queues into a Prometheus string stream
 */
export async function buildMetricsText() {
  // Grab prom-client native system/CPU tracking data
  const systemMetrics = await register.metrics();

  let customMetrics = '';
  const jobTypes = await getJobTypes();

  // --- Jobs Submitted Output ---
  customMetrics += '# HELP jobs_submitted_total Total number of jobs submitted\n';
  customMetrics += '# TYPE jobs_submitted_total counter\n';
  for (const type of jobTypes) {
    const count = await redisNum(`metrics:jobs_submitted_total:${type}`);
    customMetrics += `jobs_submitted_total{job_type="${type}"} ${count}\n`;
  }

  // --- Jobs Processed Output ---
  customMetrics += '# HELP jobs_processed_total Total number of jobs successfully processed\n';
  customMetrics += '# TYPE jobs_processed_total counter\n';
  for (const type of jobTypes) {
    const count = await redisNum(`metrics:jobs_processed_total:${type}`);
    customMetrics += `jobs_processed_total{job_type="${type}"} ${count}\n`;
  }

  // --- Job Errors Output ---
  customMetrics += '# HELP job_errors_total Total number of jobs that failed\n';
  customMetrics += '# TYPE job_errors_total counter\n';
  for (const type of jobTypes) {
    const count = await redisNum(`metrics:job_errors_total:${type}`);
    customMetrics += `job_errors_total{job_type="${type}"} ${count}\n`;
  }

  return `${systemMetrics}\n${customMetrics}`;
}

/**
 * Express middleware route generator to bind the /metrics scraper endpoint cleanly
 * Uses a default parameter assignment to accept an Express application instance safely
 */
export function setupMetricsRoute(app = {} as Express) {
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', 'text/plain; version=0.0.4');
      const metricsText = await buildMetricsText();
      res.status(200).send(metricsText);
    } catch (err) {
      console.error('[METRICS_ROUTE_ERROR]', err);
      res.status(500).send('Error rendering metrics engine data stream');
    }
  });
}

export { register };
