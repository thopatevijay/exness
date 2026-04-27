'use client';

import Link from 'next/link';
import { HealthBadge } from '@/components/HealthBadge';
import { HEALTH_SERVICES } from '@/hooks/useHealth';

export default function OpsPage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      <header className="mb-6 flex w-full max-w-md items-center justify-between">
        <h1 className="text-2xl font-semibold">Health</h1>
        <Link
          href="/webtrading"
          className="text-xs text-[color:var(--color-fg-dim)] underline hover:opacity-80"
        >
          ← Web trading
        </Link>
      </header>

      <section className="w-full max-w-md">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-[color:var(--color-fg-dim)]">
          Services
        </h2>
        <div className="flex flex-col gap-2">
          {HEALTH_SERVICES.map((svc) => (
            <HealthBadge key={svc} svc={svc} />
          ))}
        </div>
      </section>
    </main>
  );
}
