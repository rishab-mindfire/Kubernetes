import { Registry, Counter, Histogram, Gauge } from 'prom-client';

//Create a single registry to hold all metrics
export const register = new Registry();

// Counter: Tracks the number of jobs processed per worker
// Adding 'worker_id' label helps identify specific pods in Grafana
export const jobsProcessedTotal = new Counter({
  name: 'jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['worker_id'],
  registers: [register],
});

// Counter: Tracks total failed jobs
export const jobErrorsTotal = new Counter({
  name: 'job_errors_total',
  help: 'Total failed jobs',
  registers: [register],
});

// Counter: Tracks total jobs submitted
export const totalJobsSubmitted = new Counter({
  name: 'total_jobs_submitted',
  help: 'Total jobs submitted',
  registers: [register],
});

// Counter: Tracks total jobs completed successfully
export const totalJobsCompleted = new Counter({
  name: 'total_jobs_completed',
  help: 'Total jobs completed',
  registers: [register],
});

//  Histogram: Tracks processing duration with defined buckets
// Buckets (0.1s to 10s) provide clear P95/P99 latency visibility
export const jobProcessingTime = new Histogram({
  name: 'job_processing_time_seconds',
  help: 'Time taken to process jobs',
  registers: [register],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Gauge: Tracks the current queue depth
export const queueLength = new Gauge({
  name: 'queue_length',
  help: 'Current number of jobs in the queue',
  registers: [register],
});
