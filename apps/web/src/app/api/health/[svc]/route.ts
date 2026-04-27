import { NextResponse } from 'next/server';

type Endpoint = { host: string; port: number };

const ENDPOINTS: Record<string, Endpoint> = {
  api: { host: process.env.API_HEALTH_HOST ?? 'localhost', port: 9000 },
  ws: { host: process.env.WS_HEALTH_HOST ?? 'localhost', port: 9001 },
  poller: { host: process.env.POLLER_HEALTH_HOST ?? 'localhost', port: 9002 },
  uploader: { host: process.env.UPLOADER_HEALTH_HOST ?? 'localhost', port: 9003 },
  liq: { host: process.env.LIQ_HEALTH_HOST ?? 'localhost', port: 9004 },
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ svc: string }> },
): Promise<NextResponse> {
  const { svc } = await params;
  const ep = ENDPOINTS[svc];
  if (!ep) {
    return NextResponse.json({ error: 'unknown service' }, { status: 404 });
  }
  const start = Date.now();
  try {
    const res = await fetch(`http://${ep.host}:${ep.port}/health`, { cache: 'no-store' });
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
