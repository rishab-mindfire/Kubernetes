import { Worker } from 'bullmq';
import { jobsProcessedTotal, jobProcessingTime, jobErrorsTotal } from './lib/metrics.js';
import { bullMqConnection } from './lib/caseDbType.js';

// Yield the event loop periodically to keep BullMQ alive
const yieldLoop = () => new Promise<void>((resolve) => setImmediate(resolve));

const worker = new Worker(
  'math-tasks',
  async (job) => {
    const end = jobProcessingTime.startTimer();
    console.warn(`Processing job: ${job.id}`);

    try {
      // Simulate occasional failures for testing metrics/retries
      if (Math.random() < 0.05) {
        throw new Error('Simulated random worker failure by code');
      }

      const limit = job.data.limit;
      let count = 0;
      const logInterval = Math.max(1, Math.floor(limit / 20));

      for (let i = 2; i < limit; i++) {
        // Prevent BullMQ stalled-job detection
        if (i % 5000 === 0) {
          await yieldLoop();
        }

        // Log every ~5%
        if (i % logInterval === 0) {
          const percent = ((i / limit) * 100).toFixed(1);

          console.warn(`[Job ${job.id}] Progress: ${percent}% (${i}/${limit})`);
        }

        let isPrime = true;
        const sqrt = Math.sqrt(i);

        for (let j = 2; j <= sqrt; j++) {
          if (i % j === 0) {
            isPrime = false;
            break;
          }
        }

        if (isPrime) {
          count++;
        }
      }

      jobsProcessedTotal.inc();
      console.warn(`Job ${job.id} completed successfully. Prime count: ${count}`);

      return { count };
    } finally {
      end();
    }
  },
  {
    connection: bullMqConnection,
    concurrency: 1,
  }
);

// Failed jobs metric
worker.on('failed', (job, err) => {
  jobErrorsTotal.inc();
  console.error(`Job ${job?.id} failed: ${err.message}`);
});

// Successful completion log
worker.on('completed', (job) => {
  console.warn(`Job ${job.id} completed`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: NodeJS.Signals) => {
  console.warn(`${signal} received. Closing worker...`);

  try {
    await worker.close();
    console.warn('Worker closed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
