import type { Response } from 'express';

// Enhanced controller-level error handler
export const handleControllerError = (
  res: Response,
  error: unknown,
  defaultMessage: string = 'Internal Server Error',
  statusCode: number = 500,
) => {
  // Log the actual error internally for debugging
  console.warn('[Error]:', error);

  // Extract message if it's a standard Error object
  const message = error instanceof Error ? error.message : defaultMessage;

  // response structure
  return res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { rawError: error }),
  });
};
