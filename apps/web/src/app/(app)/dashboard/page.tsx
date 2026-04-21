'use client';

import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  async function logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }
  return (
    <main className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button onClick={logout} className="text-sm text-[color:var(--color-fg-dim)] underline">
          Log out
        </button>
      </div>
      <p className="mt-2 text-sm text-[color:var(--color-fg-dim)]">
        You&apos;re signed in. Stages 12–14 add the chart, order panel, and live data.
      </p>
    </main>
  );
}
