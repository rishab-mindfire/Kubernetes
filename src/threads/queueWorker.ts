import { Worker } from 'bullmq';
import { redisConnection } from '../connection/redis.js';
import { JOB_TYPE } from '../util/constants.js';
import { incJobsProcessed, incJobErrors, recordProcessingTime } from '../lib/metrics.js';
import type { JobData, JobResult } from '../util/types.js';
import { runCpuThread } from './threadRunner.js';
import { bullRedis } from '../connection/bullRedis.js';

const registeredJobTypes = new Set<string>([JOB_TYPE]);

// Initialize base known types
await redisConnection.sadd('metrics:known_job_types', JOB_TYPE);

export const queueWorker = new Worker<JobData, JobResult>(
  JOB_TYPE,
  async (job) => {
    console.warn(`[WORKER] Ingesting Job ${job.id} | Type: ${job.name}`);
    const startTime = performance.now();
    const limit = job.data.limit || 100000;

    try {
      if (!registeredJobTypes.has(job.name)) {
        registeredJobTypes.add(job.name);
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

      incJobErrors(job.name).catch((err) =>
        console.warn('[WORKER] Failed to record error metric:', err.message)
      );
      throw error;
    }
  },
  {
    connection: bullRedis,
    concurrency: 4,
    lockDuration: 120_000,
    lockRenewTime: 40_000,
    stalledInterval: 120_000,
    maxStalledCount: 1,
  }
);

queueWorker.on('failed', (job, err) => {
  console.error(`[QUEUE] Job ${job?.id} permanently failed:`, err.message);
});
