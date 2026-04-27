import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/env';

export async function POST(): Promise<NextResponse> {
  const c = await cookies();
  const token = c.get('token')?.value ?? null;
  if (!token) {
    return NextResponse.json(
      { error: { code: 'AUTH_REQUIRED', message: 'No token' } },
      { status: 401 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/v1/auth/ws-ticket`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error('[ws/ticket] backend unreachable:', err);
    return NextResponse.json(
      { message: `Backend unreachable at ${API_URL}` },
      { status: 502 },
    );
  }

  const payload = await upstream.json().catch(() => ({}));
  return NextResponse.json(payload, { status: upstream.status });
}
