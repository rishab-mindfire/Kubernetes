import type { Response } from 'express';

// Structured operational error — thrown intentionally by business logic
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const handleControllerError = (
  res: Response,
  error: unknown,
  defaultMessage = 'Internal Server Error'
): Response => {
  const isDev = process.env.NODE_ENV === 'development';

  // Known operational error — use its status and message directly
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(isDev && {
        debug: { name: error.name, stack: error.stack },
      }),
    });
  }

  // Unexpected error — always 500, log fully for debugging
  console.error('[UnhandledError]:', error);

  return res.status(500).json({
    success: false,
    message: defaultMessage,
    ...(isDev && {
      debug: {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    }),
  });
};
