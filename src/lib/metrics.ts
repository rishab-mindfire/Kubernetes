import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

// Metric for Service B (Worker)
export const jobsProcessedTotal = new Counter({
  name: 'jobs_processed_total',
  help: 'Total number of jobs processed',
  registers: [register],
});

export const jobProcessingTime = new Histogram({
  name: 'job_processing_time_seconds',
  help: 'Time taken to process jobs',
  registers: [register],
});

// Metric for Service C (Stats)
export const queueLength = new Gauge({
  name: 'queue_length',
  help: 'Current number of jobs in the queue',
  registers: [register],
});
