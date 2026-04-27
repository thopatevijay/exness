import { env } from '@exness/config';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

export type TokenType = 'access' | 'refresh';
export type JwtPayload = { sub: string; jti: string; typ: TokenType };

export function signAccessToken(userId: string): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign(
    { sub: userId, jti, typ: 'access' satisfies TokenType } satisfies JwtPayload,
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: env.JWT_EXPIRY } as SignOptions,
  );
  return { token, jti };
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign(
    { sub: userId, jti, typ: 'refresh' satisfies TokenType } satisfies JwtPayload,
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: env.JWT_REFRESH_EXPIRY } as SignOptions,
  );
  return { token, jti };
}

function verify(token: string, expected: TokenType): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || !decoded.sub || !decoded.jti) {
    throw new Error('invalid token');
  }

  const typ = (decoded as { typ?: TokenType }).typ ?? 'access';
  if (typ !== expected) throw new Error('wrong token type');
  return { sub: String(decoded.sub), jti: String(decoded.jti), typ };
}

export function verifyAccessToken(token: string): JwtPayload {
  return verify(token, 'access');
}

export function verifyRefreshToken(token: string): JwtPayload {
  return verify(token, 'refresh');
}
