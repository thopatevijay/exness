import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/env';

const ACCESS_COOKIE_MAX_AGE_S = 15 * 60;
const REFRESH_COOKIE_MAX_AGE_S = 7 * 24 * 60 * 60;

export async function POST(): Promise<NextResponse> {
  const c = await cookies();
  const refreshToken = c.get('refresh-token')?.value ?? null;
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
      // Refresh token invalid/revoked → clear both cookies so the client
      // doesn't keep retrying. Next request will hit signin again.
      c.delete({ name: 'token', path: '/' });
      c.delete({ name: 'refresh-token', path: '/api/auth/refresh' });
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
  c.set('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ACCESS_COOKIE_MAX_AGE_S,
    path: '/',
  });
  c.set('refresh-token', newRefresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFRESH_COOKIE_MAX_AGE_S,
    path: '/api/auth/refresh',
  });
  return NextResponse.json({ ok: true });
}
