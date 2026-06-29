import type { Queue } from 'bullmq';
import type { QueueStats } from '../util/types.js';

export async function getValidatedStats(mathQueue: Queue): Promise<QueueStats> {
  const counts = await mathQueue.getJobCounts(
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed'
  );
  return counts as unknown as QueueStats;
}
