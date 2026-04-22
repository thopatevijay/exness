'use client';

import { useQueries, type UseQueryResult } from '@tanstack/react-query';

export const HEALTH_SERVICES = ['api', 'ws', 'poller', 'uploader', 'liq'] as const;
export type HealthService = (typeof HEALTH_SERVICES)[number];

export type HealthPayload = {
  ok: boolean;
  latencyMs: number | null;
  body: Record<string, unknown> | null;
};

async function fetchHealth(svc: HealthService): Promise<HealthPayload> {
  const res = await fetch(`/api/health/${svc}`, { cache: 'no-store' });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const latencyMs =
    body && typeof body['_latencyMs'] === 'number'
      ? // eslint-disable-next-line no-restricted-syntax -- server-provided latency number
        Number(body['_latencyMs'])
      : null;
  return { ok: res.ok, latencyMs, body };
}

export function useHealth(svc: HealthService): UseQueryResult<HealthPayload> {
  const results = useHealthAll();
  const idx = HEALTH_SERVICES.indexOf(svc);
  // useQueries returns a stable-length array; cast the slice element narrowly.
  return results[idx] as UseQueryResult<HealthPayload>;
}

export function useHealthAll(): UseQueryResult<HealthPayload>[] {
  return useQueries({
    queries: HEALTH_SERVICES.map((svc) => ({
      queryKey: ['health', svc],
      queryFn: () => fetchHealth(svc),
      refetchInterval: 5_000,
    })),
  });
}
