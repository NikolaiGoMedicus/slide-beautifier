import type { Request, Response, NextFunction } from 'express';
import type { AppError } from '../types/index.js';

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err.message);

  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'UNKNOWN';

  res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected error occurred',
    errorCode,
  });
}
