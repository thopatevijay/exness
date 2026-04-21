import { type ErrorCode } from '@exness/shared';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Spec-compliant 411 wrapper for input validation
export class IncorrectInputsError extends Error {}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof IncorrectInputsError || err instanceof ZodError) {
    res.status(411).json({ message: 'Incorrect inputs' });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // final fallback; pino-http already logged the request
  console.error({ err, requestId: req.requestId }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
