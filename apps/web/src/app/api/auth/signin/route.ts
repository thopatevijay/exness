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

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/v1/user/signin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
  } catch (err) {
    console.error('[auth/signin] backend unreachable:', err);
    return NextResponse.json(
      { message: `Backend unreachable at ${API_URL} — is the api service running?` },
      { status: 502 },
    );
  }

  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(payload, { status: upstream.status });
  }
  const { token, refreshToken } = payload as { token?: string; refreshToken?: string };
  if (!token || !refreshToken) {
    return NextResponse.json(
      { message: 'no token pair in backend response' },
      { status: 502 },
    );
  }
  const c = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  c.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: ACCESS_COOKIE_MAX_AGE_S,
    path: ACCESS_COOKIE_PATH,
  });
  c.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: REFRESH_COOKIE_MAX_AGE_S,
    path: REFRESH_COOKIE_PATH,
  });
  return NextResponse.json({ ok: true });
}
