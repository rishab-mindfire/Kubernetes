import { Worker } from 'bullmq';
import { redisConnection } from './lib/redis';
import { jobsProcessedTotal, jobProcessingTime } from './lib/metrics';

const worker = new Worker('math-tasks', async (job) => {
  const start = Date.now();

  // CPU intensive logic
  const limit = job.data.limit;
  const primes = [];
  for (let i = 2; i < limit; i++) {
    let isPrime = true;
    for (let j = 2; j <= Math.sqrt(i); j++) { if (i % j === 0) isPrime = false; }
    if (isPrime) primes.push(i);
  }

  jobProcessingTime.observe((Date.now() - start) / 1000);
  jobsProcessedTotal.inc();
  return { count: primes.length };
}, { connection: redisConnection as any, concurrency: 1 });

console.log('Worker is running...');
