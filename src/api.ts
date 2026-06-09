import express from 'express';
import { Queue } from 'bullmq';
import { queueLength, register } from './lib/metrics.js';
import { bullMqConnection } from './lib/caseDbType.js';

const app = express();
app.use(express.json());
const mathQueue = new Queue('math-tasks', { connection: bullMqConnection });

// SERVICE : A
// add jobs
app.post('/submit', async (req, res) => {
  try {
    const job = await mathQueue.add('calculate-primes', { limit: 100000000 }, {
      attempts: 3, // Retry failed jobs
      backoff: { type: 'exponential', delay: 1000 }
    });
    res.json({ id: job.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to queue job" });
  }
});

// SERVICE : B
//get job status by id
app.get('/status/:id', async (req, res) => {
  const job = await mathQueue.getJob(req.params.id);
  res.json({ status: await job?.getState(), result: job?.returnvalue });
});

// SERVICE : C
// Returns queue stats
app.get('/stats', async (req, res) => {
  try {
    const counts = await mathQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    const currentLength = counts.waiting + counts.active;

    // the Gauge
    queueLength.set(currentLength);

    res.json({
      queue: 'math-tasks',
      timestamp: new Date().toISOString(),
      stats: counts,
      length: currentLength
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// extra helper API-end-points
//  Retry failed jobs reset
app.post('/queue/reset', async (req, res) => {
  const failedJobs = await mathQueue.getFailed();
  await Promise.all(failedJobs.map(job => job.retry()));
  res.json({ message: `Retried ${failedJobs.length} failed jobs` });
});

// metrics
app.get('/metrics', async (req, res) => {
  // Get custom metrics from prom-client
  const customMetrics = await register.metrics();

  // Get BullMQ built-in metrics
  const bullMetrics = await mathQueue.exportPrometheusMetrics();

  res.set('Content-Type', 'text/plain');
  res.send(`${customMetrics}\n${bullMetrics}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
