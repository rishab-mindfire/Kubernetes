import express from 'express';
import { Queue } from 'bullmq';
import { register, queueLength, totalJobsSubmitted, totalJobsCompleted } from './lib/metrics.js';
import { bullMqConnection } from './lib/caseDbType.js';

const app = express();
const mathQueue = new Queue('math-tasks', { connection: bullMqConnection });

// Dynamically extract the JobCounts type from the BullMQ Queue method
type JobCounts = Awaited<ReturnType<Queue['getJobCounts']>>;

// Initialize state
let lastCounts: JobCounts = {
  completed: 0,
  failed: 0,
  waiting: 0,
  active: 0,
  delayed: 0,
};

// Polls Redis every 5 seconds
setInterval(async () => {
  try {
    const counts = await mathQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );

    // Update Gauge: Current Queue Depth
    const currentLength = counts.waiting + counts.active;
    queueLength.set(currentLength);

    // Update Counters: Increment by delta to ensure accurate rates
    const completedDelta = counts.completed - lastCounts.completed;
    if (completedDelta > 0) {
      totalJobsCompleted.inc(completedDelta);
    }

    const currentTotal = counts.waiting + counts.active + counts.completed + counts.failed;
    const previousTotal =
      lastCounts.waiting + lastCounts.active + lastCounts.completed + lastCounts.failed;
    const submittedDelta = currentTotal - previousTotal;

    if (submittedDelta > 0) {
      totalJobsSubmitted.inc(submittedDelta);
    }

    // Update state for next interval
    lastCounts = counts;
  } catch (err) {
    console.error('Error polling Redis for metrics:', err);
  }
}, 5000);

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

// JSON stats endpoint for local/web debugging
app.get('/stats', async (req, res) => {
  const counts = await mathQueue.getJobCounts(
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed'
  );
  res.json({
    queue: 'math-tasks',
    totalSubmitted: counts.waiting + counts.active + counts.completed + counts.failed,
    totalCompleted: counts.completed,
    queueLength: counts.waiting + counts.active,
    stats: counts,
  });
});

const PORT = process.env.AGGREGATOR_PORT || 3002;
app.listen(PORT, () => console.warn(`Aggregator (Service C) running on port ${PORT}`));
