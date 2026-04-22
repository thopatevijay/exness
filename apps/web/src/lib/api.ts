// Client-side fetch wrapper. Always same-origin — backend calls go through
// Next.js route handlers that proxy with the JWT from the httpOnly cookie.

import { rememberRequestId } from './requestIdMemory';

export class ApiResponseError extends Error {
  public readonly status: number;
  public readonly body: unknown;
  constructor(status: number, body: unknown) {
    const msg =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: unknown }).message)
        : typeof body === 'object' &&
            body &&
            'error' in body &&
            typeof (body as { error: unknown }).error === 'object'
          ? String(((body as { error: { message?: unknown } }).error.message ?? 'API error'))
          : 'API error';
    super(msg);
    this.status = status;
    this.body = body;
  }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const method = (init.method ?? 'GET').toUpperCase();
  if (MUTATING.has(method) && !headers['x-request-id']) {
    const id = crypto.randomUUID();
    headers['x-request-id'] = id;
    rememberRequestId(id);
  }
  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) throw new ApiResponseError(res.status, body);
  return body as T;
}
