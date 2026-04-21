import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/env';

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.text();
  const upstream = await fetch(`${API_URL}/api/v1/user/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const payload = await upstream.json().catch(() => ({}));
  return NextResponse.json(payload, { status: upstream.status });
}
