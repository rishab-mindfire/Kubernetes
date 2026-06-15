import type { Response } from 'express';
import { jobErrorsTotal } from '../lib/metrics.js';
import type { Job } from 'bullmq';

// Enhanced controller-level error handler
export const handleControllerError = (
  res: Response,
  error: unknown,
  defaultMessage: string = 'Internal Server Error',
  statusCode: number = 500
) => {
  // Log error internally for debugging
  console.warn('[Error]:', error);
  // standard Error object
  const message = error instanceof Error ? error.message : defaultMessage;
  // response structure
  return res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { rawError: error }),
  });
};

//Centrally handles, logs, and increments metrics for worker task failures.
export const handleWorkerError = (job: Job, err: unknown): void => {
  //  Increment the metric instantly
  jobErrorsTotal.inc();
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error(`[TASK_FAILED] ID: ${job.id} | Error: ${errorMessage}`);
};
