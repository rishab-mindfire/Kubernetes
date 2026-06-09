import { Worker } from 'bullmq';
import { jobsProcessedTotal, jobProcessingTime } from './lib/metrics';
import { bullMqConnection } from './lib/caseDbType';

// Yield the loop to prevent "Stalled Job" errors
const yieldLoop = () => new Promise(resolve => setImmediate(resolve));

const worker = new Worker('math-tasks', async (job) => {
  const end = jobProcessingTime.startTimer();
  console.log(`Processing job: ${job.id}`);

  try {
    const limit = job.data.limit;
    let count = 0;
    const logInterval = Math.floor(limit / 20); // Log progress every 5%

    for (let i = 2; i < limit; i++) {
      // Yield to keep the event loop alive to Redis
      if (i % 5000 === 0) await yieldLoop();
      // Log progress periodically
      if (i % logInterval === 0) {
        const percent = ((i / limit) * 100).toFixed(1);
        console.log(`[Job ${job.id}] Progress: ${percent}% (Checked ${i}/${limit})`);
      }

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

    jobsProcessedTotal.inc();
    return { count };
  } finally {
    end();
  }
}, {
  connection: bullMqConnection,
  concurrency: 1
});

worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed: ${err.message}`));
