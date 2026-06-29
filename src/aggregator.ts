import 'dotenv/config';
import express from 'express';
import { Queue } from 'bullmq';
import { incJobErrors, incJobsProcessed, setupMetricsRoute } from './lib/metrics.js';
import { handleControllerError } from './util/errorHandler.js';
import { bullMqConnection, type QueueStats } from './util/types.js';
import { getValidatedStats } from './lib/count.js';

const app = express();
setupMetricsRoute(app);

const mathQueue = new Queue('math-tasks', { connection: bullMqConnection });
let lastCounts = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };

setInterval(async () => {
  try {
    const currentCounts: QueueStats = await getValidatedStats(mathQueue);

    // Calculate deltas
    const completedDelta = currentCounts.completed - lastCounts.completed;
    const failedDelta = currentCounts.failed - lastCounts.failed;

    // Use your Redis-backed helpers instead of prom-client counters
    if (completedDelta > 0) {
      await incJobsProcessed('math-tasks');
    }
    if (failedDelta > 0) {
      await incJobErrors('math-tasks');
    }

    lastCounts = currentCounts;
  } catch (err) {
    console.error('[METRICS_POLL_ERROR]', err);
  }
}, Number(process.env.POOL_INTERVAL));

app.get('/stats', async (req, res) => {
  try {
    const counts = await mathQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );
    res.json({ queueLength: counts.waiting + counts.active, stats: counts });
  } catch (error) {
    handleControllerError(res, error, 'Failed to retrieve stats');
  }
});

// Simple health probe
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', worker: 'active' });
});

const PORT = process.env.AGGREGATOR_PORT || 3002;
app.listen(PORT, () => console.warn(`[SYSTEM] Aggregator running on port ${PORT}`));
