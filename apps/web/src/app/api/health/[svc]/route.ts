import { NextResponse } from 'next/server';

const PORTS: Record<string, number> = {
  api: 9000,
  ws: 9001,
  poller: 9002,
  uploader: 9003,
  liq: 9004,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ svc: string }> },
): Promise<NextResponse> {
  const { svc } = await params;
  const port = PORTS[svc];
  if (port === undefined) {
    return NextResponse.json({ error: 'unknown service' }, { status: 404 });
  }
  const start = Date.now();
  try {
    const res = await fetch(`http://localhost:${port}/health`, { cache: 'no-store' });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(
      { ...body, _latencyMs: Date.now() - start },
      { status: res.status },
    );
  } catch {
    return NextResponse.json(
      { service: svc, checks: { error: 'unreachable' }, _latencyMs: Date.now() - start },
      { status: 503 },
    );
  }
}
