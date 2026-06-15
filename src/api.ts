import 'dotenv/config';
import express from 'express';
import { Queue } from 'bullmq';
import { queueLength, setupMetricsRoute, totalJobsSubmitted } from './lib/metrics.js';
import { bullMqConnection } from './lib/caseDbType.js';
import { handleControllerError } from './util/errorHandler.js';

const app = express();
app.use(express.json());

// Initialize the /metrics
setupMetricsRoute(app);

// Initialize Queue
const mathQueue = new Queue('math-tasks', { connection: bullMqConnection });

// (Add jobs)
app.post('/submit', async (req, res) => {
  try {
    const job = await mathQueue.add(
      'calculate-primes',
      { limit: 100000 },
      {
        attempts: 1,
      }
    );
    totalJobsSubmitted.inc();
    res.json({ id: job.id });
  } catch (error) {
    handleControllerError(res, error, 'Failed to queue job');
  }
});

// (Get job status)
app.get('/status/:id', async (req, res) => {
  try {
    const job = await mathQueue.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    res.json({ status: await job.getState(), result: job.returnvalue });
  } catch (error) {
    handleControllerError(res, error, 'Failed to get job status');
  }
});

//  (Returns queue stats)
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

    // Update gauge
    queueLength.set(currentLength);

    res.json({
      queue: 'math-tasks',
      queueLength: currentLength,
      stats: counts,
    });
  } catch (error) {
    handleControllerError(res, error, 'Failed to retrieve stats');
  }
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.warn(`API running on port ${PORT}`);
});
