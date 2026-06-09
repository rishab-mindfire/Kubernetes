import { Registry, Counter, Histogram } from 'prom-client';
export const register = new Registry();

export const jobsProcessedTotal = new Counter({
  name: 'jobs_processed_total',
  help: 'Total jobs completed',
  registers: [register],
});

export const jobProcessingTime = new Histogram({
  name: 'job_processing_time_seconds',
  help: 'Time taken to process jobs',
  registers: [register],
});
