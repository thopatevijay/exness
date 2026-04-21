import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && /^[\w-]{6,}$/.test(incoming) ? incoming : uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
}
