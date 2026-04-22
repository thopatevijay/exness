import Link from 'next/link';
import { SocketMount } from '@/components/SocketMount';
import { TickerStrip } from '@/components/TickerStrip';

export default function Landing() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <SocketMount />
      <h1 className="text-4xl font-semibold tracking-tight">Exness Clone</h1>
      <p className="mt-4 text-lg text-[color:var(--color-fg-dim)]">
        Live Binance prices, leveraged margin trading, automatic liquidation. Open a position,
        watch it move, get out before you blow up.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-md border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--color-bg-elevated)]"
        >
          Sign up
        </Link>
      </div>
      <TickerStrip />
    </main>
  );
}
