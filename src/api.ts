import express from 'express';
import { Queue } from 'bullmq';
import { redisConnection } from './lib/redis';
import { register } from './lib/metrics';

const app = express();
app.use(express.json());
const mathQueue = new Queue('math-tasks', { connection: redisConnection as any });

// SERVICE : A
// add jobs
app.post('/submit', async (req, res) => {
  const job = await mathQueue.add('calculate-primes', { limit: 100000 });
  res.json({ id: job.id });
});

// SERVICE : B
//get job status by id
app.get('/status/:id', async (req, res) => {
  const job = await mathQueue.getJob(req.params.id);
  res.json({ status: await job?.getState(), result: job?.returnvalue });
});

// SERVICE : C
// get metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(3000, () => console.log('API running on port 3000'));
