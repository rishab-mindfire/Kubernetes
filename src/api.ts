import express from 'express';
import { Queue } from 'bullmq';
import { register } from './lib/metrics';
import { bullMqConnection } from './lib/caseDbType';

const app = express();
app.use(express.json());
const mathQueue = new Queue('math-tasks', { connection: bullMqConnection });

// SERVICE : A
// add jobs
app.post('/submit', async (req, res) => {
  try {
    const job = await mathQueue.add('calculate-primes', { limit: 10000000 }, {
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

    res.json({
      queue: 'math-tasks',
      timestamp: new Date().toISOString(),
      stats: counts,
      length: counts.waiting + counts.active
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
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.listen(3000, () => console.log('API running on port 3000'));
