import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { IncorrectInputsError } from './error.js';

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new IncorrectInputsError());
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new IncorrectInputsError());
      return;
    }
    Object.assign(req.query, result.data);
    next();
  };
}
