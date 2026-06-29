import type { Response } from 'express';

// error handler
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
