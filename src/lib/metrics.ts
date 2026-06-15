import client from 'prom-client';
import { type Express, type Request, type Response } from 'express';

// isolated registry instance for application metrics
const register = new client.Registry();
register.clear();

// collect default system metrics like CPU, memory, and event loop lag
client.collectDefaultMetrics({ register });
export { register };

//  count of jobs waiting or processing in the queue
export const queueLength = new client.Gauge({
  name: 'queue_length',
  help: 'Current number of jobs in the queue',
  registers: [register],
});

// total number of jobs that successfully completed
export const totalJobsCompleted = new client.Counter({
  name: 'total_jobs_completed',
  help: 'Total jobs completed successfully',
  registers: [register],
});

//failure job
export const jobErrorsTotal = new client.Counter({
  name: 'job_errors_total',
  help: 'Total individual job attempt failures',
  registers: [register],
});

// Counter tracking the total number of new jobs pushed into the queue by the API
export const totalJobsSubmitted = new client.Counter({
  name: 'total_jobs_submitted',
  help: 'Total jobs submitted to the queue',
  registers: [register],
});

// Histogram measuring job processing
export const jobProcessingTime = new client.Histogram({
  name: 'job_processing_time_seconds',
  help: 'Time taken to process jobs',
  registers: [register],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

// Express route initializer exposing collected Prometheus scraping data at /metrics
export const setupMetricsRoute = (app: Express): void => {
  app.get('/metrics', async (req: Request, res: Response): Promise<void> => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  });
};
