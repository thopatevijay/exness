import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from './cookies';
import { API_URL } from './env';

type ProxyOpts = {
  auth?: boolean; // attach Bearer from cookie
};

/**
 * Server-side proxy helper. Forwards a GET (or with `init`) to the backend at
 * `API_URL{backendPath}`. When `auth` is true, the httpOnly `token` cookie is
 * converted to `Authorization: Bearer`. Backend errors pass through verbatim.
 */
export async function proxy(
  req: Request,
  backendPath: string,
  { auth = true }: ProxyOpts = {},
): Promise<NextResponse> {
  const headers: Record<string, string> = {};
  if (auth) {
    const c = await cookies();
    const token = c.get(ACCESS_COOKIE)?.value;
    if (!token) {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'No token' } },
        { status: 401 },
      );
    }
    headers['authorization'] = `Bearer ${token}`;
  }

  // Preserve query string from the incoming request
  const incoming = new URL(req.url);
  const target = `${API_URL}${backendPath}${incoming.search}`;

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.text();
    if (body) {
      init.body = body;
      headers['content-type'] = req.headers.get('content-type') ?? 'application/json';
    }
  }

  const incomingReqId = req.headers.get('x-request-id');
  if (incomingReqId) headers['x-request-id'] = incomingReqId;
  const idemKey = req.headers.get('idempotency-key');
  if (idemKey) headers['idempotency-key'] = idemKey;

  const upstream = await fetch(target, init);
  const payload = await upstream.json().catch(() => ({}));
  return NextResponse.json(payload, { status: upstream.status });
}
