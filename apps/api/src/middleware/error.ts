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
  // body-parser surface: payload too large, malformed json, etc.
  if (err && typeof err === 'object' && 'status' in err && 'type' in err) {
    const e = err as { status: number; type: string; message?: string };
    if (e.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'INVALID_INPUT', message: 'Payload too large' } });
      return;
    }
    if (e.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Malformed JSON' } });
      return;
    }
  }
  console.error({ err, requestId: req.requestId }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
