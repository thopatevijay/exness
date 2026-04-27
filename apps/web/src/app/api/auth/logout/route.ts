import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/env';

export async function POST(): Promise<NextResponse> {
  const c = await cookies();
  const token = c.get('token')?.value ?? null;
  const refreshToken = c.get('refresh-token')?.value ?? null;

  if (token || refreshToken) {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(refreshToken ? { cookie: `refresh-token=${refreshToken}` } : {}),
        },
      });
    } catch (err) {
      console.warn('[auth/logout] backend unreachable, clearing cookies anyway:', err);
    }
  }

  c.delete({ name: 'token', path: '/' });
  c.delete({ name: 'refresh-token', path: '/api/auth/refresh' });
  return NextResponse.json({ ok: true });
}
