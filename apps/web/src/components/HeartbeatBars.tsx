'use client';

import { cn } from '@/lib/utils';

type Tone = 'ok' | 'down' | 'loading';

const BAR_COUNT = 20;
const STAGGER_MS = 70;

export function HeartbeatBars({ tone }: { tone: Tone }) {
  const color =
    tone === 'ok'
      ? 'bg-[color:var(--color-up)]'
      : tone === 'down'
        ? 'bg-[color:var(--color-down)]'
        : 'bg-[color:var(--color-fg-dim)]';
  const animate = tone === 'ok';
  return (
    <div
      className="flex h-4 items-end gap-[2px]"
      aria-label={tone === 'ok' ? 'healthy' : tone === 'down' ? 'unhealthy' : 'loading'}
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <span
          key={i}
          className={cn('h-full w-[2px] rounded-sm', color, animate && 'hb-bar')}
          style={animate ? { animationDelay: `${i * STAGGER_MS}ms` } : { opacity: 0.3 }}
        />
      ))}
    </div>
  );
}
