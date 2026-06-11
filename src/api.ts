import express from 'express';
import { Queue } from 'bullmq';
import { queueLength } from './lib/metrics.js';
import { bullMqConnection } from './lib/caseDbType.js';
import { handleControllerError } from './util/errorHandler.js';

const app = express();
app.use(express.json());
const mathQueue = new Queue('math-tasks', { connection: bullMqConnection });

// SERVICE : A ( add jobs )
app.post('/submit', async (req, res) => {
  try {
    const job = await mathQueue.add(
      'calculate-primes',
      { limit: 10000000 },
      {
        attempts: 3, // Retry failed jobs
        backoff: { type: 'exponential', delay: 1000 },
      }
    );
    res.json({ id: job.id });
  } catch (error) {
    handleControllerError(res, error, 'Failed to queue job');
  }
});

// SERVICE : B (get job status by id)
app.get('/status/:id', async (req, res) => {
  const job = await mathQueue.getJob(req.params.id);
  res.json({ status: await job?.getState(), result: job?.returnvalue });
});

// SERVICE : C (Returns queue stats)
app.get('/stats', async (req, res) => {
  try {
    const counts = await mathQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );
    const currentLength = counts.waiting + counts.active;

    // the Gauge
    queueLength.set(currentLength);
    res.json({
      queue: 'math-tasks',
      queueLength: currentLength,
      totalSubmitted: counts.waiting + counts.active + counts.completed + counts.failed,
      totalCompleted: counts.completed,
      totalFailed: counts.failed,
      stats: counts,
    });
  } catch (error) {
    handleControllerError(res, error, 'Failed to retrieve stats');
  }
});

// extra helper end points : ----------------------------------------
// API-end-points (Retry failed jobs or reset)
app.post('/queue/reset', async (req, res) => {
  const failedJobs = await mathQueue.getFailed();
  await Promise.all(failedJobs.map((job) => job.retry()));
  res.json({ message: `Retried ${failedJobs.length} failed jobs` });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.warn(`API running on port ${PORT}`);
});
