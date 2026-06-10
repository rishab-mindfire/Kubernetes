import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

export const jobsProcessedTotal = new Counter({
  name: 'jobs_processed_total',
  help: 'Total number of jobs processed',
  registers: [register],
});

export const jobErrorsTotal = new Counter({
  name: 'job_errors_total',
  help: 'Total failed jobs',
  registers: [register],
});

export const totalJobsSubmitted = new Counter({
  name: 'total_jobs_submitted',
  help: 'Total jobs submitted',
  registers: [register],
});

export const totalJobsCompleted = new Counter({
  name: 'total_jobs_completed',
  help: 'Total jobs completed',
  registers: [register],
});

export const jobProcessingTime = new Histogram({
  name: 'job_processing_time_seconds',
  help: 'Time taken to process jobs',
  registers: [register],
});

export const queueLength = new Gauge({
  name: 'queue_length',
  help: 'Current number of jobs in the queue',
  registers: [register],
});
