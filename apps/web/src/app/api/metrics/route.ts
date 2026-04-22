import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/env';

export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch(`${API_URL}/metrics`, { cache: 'no-store' });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'text/plain' },
    });
  } catch {
    return NextResponse.json({ error: 'metrics unavailable' }, { status: 502 });
  }
}
