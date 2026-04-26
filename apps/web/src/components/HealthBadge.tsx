'use client';

import { HeartbeatBars } from './HeartbeatBars';
import { useHealth, type HealthService } from '@/hooks/useHealth';

const LABELS: Record<HealthService, string> = {
  api: 'api',
  ws: 'ws-server',
  poller: 'price-poller',
  uploader: 'batch-uploader',
  liq: 'liquidation-worker',
};

export function HealthBadge({ svc }: { svc: HealthService }) {
  const { data, isLoading } = useHealth(svc);
  const ok = !isLoading && data?.ok === true;
  const tone: 'ok' | 'down' | 'loading' = isLoading ? 'loading' : ok ? 'ok' : 'down';
  return (
    <div className="flex items-center justify-between rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-3 py-2">
      <div className="flex items-center gap-3">
        <HeartbeatBars tone={tone} />
        <span className="font-mono text-sm">{LABELS[svc]}</span>
      </div>
      <span className="text-xs text-[color:var(--color-fg-dim)]">
        {isLoading ? '…' : ok ? `${data?.latencyMs ?? 0}ms ago` : 'down'}
      </span>
    </div>
  );
}
