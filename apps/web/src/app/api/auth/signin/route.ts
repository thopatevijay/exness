import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
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
  const token = (payload as { token?: string }).token;
  if (!token) {
    return NextResponse.json({ message: 'no token in backend response' }, { status: 502 });
  }
  const c = await cookies();
  c.set('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60,
    path: '/',
  });
  return NextResponse.json({ ok: true });
}
