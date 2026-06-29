import 'dotenv/config';
import express from 'express';
import { Queue } from 'bullmq';
import { incJobsSubmitted, setupMetricsRoute } from './lib/metrics.js';
import { handleControllerError } from './util/errorHandler.js';
import { bullMqConnection } from './util/types.js';

const app = express();
app.use(express.json());

// Initialize Metrics
setupMetricsRoute(app);

const mathQueue = new Queue('math-tasks', { connection: bullMqConnection });

app.post('/submit', async (req, res) => {
  try {
    // Submit to BullMQ
    const job = await mathQueue.add('calculate-primes', { limit: 100000 });

    //  increment the submission metric
    await incJobsSubmitted('calculate-primes');

    res.json({ id: job.id });
  } catch (error) {
    handleControllerError(res, error, 'Failed to queue job');
  }
});

app.get('/status/:id', async (req, res) => {
  try {
    const job = await mathQueue.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ status: await job.getState(), result: job.returnvalue });
  } catch (error) {
    handleControllerError(res, error, 'Failed to get job status');
  }
});

// Simple health probe
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', worker: 'active' });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => console.warn(`[API] Submitter running on port ${PORT}`));
