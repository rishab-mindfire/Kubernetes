import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { Queue } from 'bullmq';
import {
  queueLength,
  totalJobsSubmitted,
  totalJobsCompleted,
  jobErrorsTotal,
  setupMetricsRoute,
} from './lib/metrics.js';
import { bullMqConnection } from './lib/caseDbType.js';
import { handleControllerError } from './util/errorHandler.js';

const app = express();
app.use(express.json());
setupMetricsRoute(app);

export interface QueueStats {
  completed: number;
  failed: number;
  waiting: number;
  active: number;
  delayed: number;
}

const mathQueue = new Queue('math-tasks', { connection: bullMqConnection });

function mapToQueueStats(counts: Record<string, number>): QueueStats {
  return {
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
  };
}

let lastCounts: QueueStats = {
  completed: 0,
  failed: 0,
  waiting: 0,
  active: 0,
  delayed: 0,
};
let isFirstRun = true;

// Background polling loop syncing Redis states to Prometheus metrics
setInterval(async () => {
  try {
    const rawCounts = await mathQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );
    const counts: QueueStats = mapToQueueStats(rawCounts);

    // Gauge: Active current Queue Depth
    queueLength.set(counts.waiting + counts.active);

    if (!isFirstRun) {
      // Counter: Total Jobs Completed
      const completedDelta = counts.completed - lastCounts.completed;
      if (completedDelta > 0) totalJobsCompleted.inc(completedDelta);

      // Compute and increment the failed delta straight from Redis state
      const failedDelta = counts.failed - lastCounts.failed;
      if (failedDelta > 0) jobErrorsTotal.inc(failedDelta);

      // Counter: Total Jobs Submitted
      const currentTotal = counts.waiting + counts.active + counts.completed + counts.failed;
      const previousTotal =
        lastCounts.waiting + lastCounts.active + lastCounts.completed + lastCounts.failed;
      const submittedDelta = currentTotal - previousTotal;

      if (submittedDelta > 0) totalJobsSubmitted.inc(submittedDelta);
    } else {
      isFirstRun = false;
    }

    lastCounts = counts;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[METRICS_POLL_ERROR] Failed to fetch queue counts:', message);
  }
}, 5000);

// Submission endpoint forcing NO retries so errors register instantly
app.post('/submit', async (req: Request, res: Response): Promise<void> => {
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
  } catch (error: unknown) {
    handleControllerError(res, error, 'Failed to queue job');
  }
});

app.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawCounts = await mathQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );
    const counts = mapToQueueStats(rawCounts);
    res.json({
      queue: 'math-tasks',
      queueLength: counts.waiting + counts.active,
      stats: counts,
    });
  } catch (error: unknown) {
    handleControllerError(res, error, 'Failed to retrieve stats');
  }
});

const PORT = process.env.AGGREGATOR_PORT || 3002;
app.listen(PORT, () => console.warn(`[SYSTEM] Aggregator running on port ${PORT}`));
