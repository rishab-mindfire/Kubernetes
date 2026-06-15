import 'dotenv/config';
import express from 'express';
import { Worker, Job } from 'bullmq';
import {
  totalJobsCompleted,
  jobErrorsTotal,
  jobProcessingTime,
  setupMetricsRoute,
} from './lib/metrics.js';
import { bullMqConnection } from './lib/caseDbType.js';

const app = express();
setupMetricsRoute(app);

const METRICS_PORT = process.env.WORKER_METRICS_PORT || 3003;
app.listen(METRICS_PORT, () => {
  console.info(`[SYSTEM] Worker metrics server listening on port ${METRICS_PORT}`);
});

const yieldLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const worker = new Worker(
  'math-tasks',
  async (job: Job) => {
    console.info(`[TASK_PROCESSING] ID: ${job.id} | Attempt: ${job.attemptsMade + 1}`);
    const end = jobProcessingTime.startTimer();

    try {
      // Simulate Random 50% Failure
      if (Math.random() < 0.5) {
        throw new Error('Simulated random failure');
      }

      const limit = job.data.limit;
      let count = 0;

      for (let i = 2; i < limit; i++) {
        if (i % 5000 === 0) await yieldLoop();
        let isPrime = true;
        const sqrt = Math.sqrt(i);
        for (let j = 2; j <= sqrt; j++) {
          if (i % j === 0) {
            isPrime = false;
            break;
          }
        }
        if (isPrime) count++;
      }

      totalJobsCompleted.inc();
      console.info(`[TASK_DONE] ID: ${job.id} | Prime count: ${count}`);
      return { count };
    } catch (err: unknown) {
      jobErrorsTotal.inc();
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[TASK_FAILED] ID: ${job.id} | Error: ${message}`);
      throw err;
    } finally {
      end();
    }
  },
  {
    connection: bullMqConnection,
    concurrency: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
    limiter: { max: 100, duration: 1000 },
  }
);

worker.on('ready', () => console.info('[QUEUE_CONNECTION] Worker ready.'));
worker.on('active', (job) => console.info(`[QUEUE_PROCESS] Job ${job.id} active`));
worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[QUEUE_PROCESS] Job ${job?.id} has permanently failed:`, err.message);
});

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
