import { env } from '@exness/config';
import jwt, { type SignOptions } from 'jsonwebtoken';

export type JwtPayload = { sub: string };

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies JwtPayload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRY,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || !decoded.sub) throw new Error('invalid token');
  return decoded as JwtPayload;
}
