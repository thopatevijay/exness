import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/env';

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/v1/user/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
  } catch (err) {
    console.error('[auth/signup] backend unreachable:', err);
    return NextResponse.json(
      { message: `Backend unreachable at ${API_URL} — is the api service running?` },
      { status: 502 },
    );
  }
  const payload = await upstream.json().catch(() => ({}));
  return NextResponse.json(payload, { status: upstream.status });
}
