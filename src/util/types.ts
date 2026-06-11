import type { Queue } from 'bullmq';

// Dynamically extract the JobCounts type from the BullMQ Queue method
export type JobCounts = Awaited<ReturnType<Queue['getJobCounts']>>;
