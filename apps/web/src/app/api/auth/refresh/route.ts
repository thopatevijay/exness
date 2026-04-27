import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE_S,
  ACCESS_COOKIE_PATH,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE_S,
  REFRESH_COOKIE_PATH,
} from '@/lib/cookies';
import { API_URL } from '@/lib/env';

export async function POST(): Promise<NextResponse> {
  const c = await cookies();
  const refreshToken = c.get(REFRESH_COOKIE)?.value ?? null;
  if (!refreshToken) {
    return NextResponse.json({ message: 'No refresh token' }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (err) {
    console.error('[auth/refresh] backend unreachable:', err);
    return NextResponse.json(
      { message: `Backend unreachable at ${API_URL}` },
      { status: 502 },
    );
  }

  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    if (upstream.status === 401) {
      c.delete({ name: ACCESS_COOKIE, path: ACCESS_COOKIE_PATH });
      c.delete({ name: REFRESH_COOKIE, path: REFRESH_COOKIE_PATH });
    }
    return NextResponse.json(payload, { status: upstream.status });
  }

  const { token, refreshToken: newRefresh } = payload as {
    token?: string;
    refreshToken?: string;
  };
  if (!token || !newRefresh) {
    return NextResponse.json(
      { message: 'no token pair in backend response' },
      { status: 502 },
    );
  }
  const secure = process.env.NODE_ENV === 'production';
  c.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: ACCESS_COOKIE_MAX_AGE_S,
    path: ACCESS_COOKIE_PATH,
  });
  c.set(REFRESH_COOKIE, newRefresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: REFRESH_COOKIE_MAX_AGE_S,
    path: REFRESH_COOKIE_PATH,
  });
  return NextResponse.json({ ok: true });
}
