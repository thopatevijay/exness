import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_PATH,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
} from '@/lib/cookies';
import { API_URL } from '@/lib/env';

const API_REFRESH_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Secure-refresh-token' : 'refresh-token';

export async function POST(): Promise<NextResponse> {
  const c = await cookies();
  const token = c.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = c.get(REFRESH_COOKIE)?.value ?? null;

  if (token || refreshToken) {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(refreshToken ? { cookie: `${API_REFRESH_COOKIE}=${refreshToken}` } : {}),
        },
      });
    } catch (err) {
      console.warn('[auth/logout] backend unreachable, clearing cookies anyway:', err);
    }
  }

  c.delete({ name: ACCESS_COOKIE, path: ACCESS_COOKIE_PATH });
  c.delete({ name: REFRESH_COOKIE, path: REFRESH_COOKIE_PATH });
  return NextResponse.json({ ok: true });
}
