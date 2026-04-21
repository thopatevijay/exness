import { env } from '@exness/config';
import jwt from 'jsonwebtoken';

export type JwtPayload = { sub: string };

export function verifyTokenFromQuery(url: string | undefined): string {
  if (!url) throw new Error('no url');
  const params = new URL(url, 'http://localhost').searchParams;
  const token = params.get('token');
  if (!token) throw new Error('no token');
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || !decoded.sub) throw new Error('bad token');
  return (decoded as JwtPayload).sub;
}
