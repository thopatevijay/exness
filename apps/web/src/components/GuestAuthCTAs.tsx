'use client';

import Link from 'next/link';


export function GuestAuthCTAs() {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login?next=/webtrading"
        className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[color:var(--color-bg-elevated)]"
      >
        Sign in
      </Link>
      <Link
        href="/signup?next=/webtrading"
        className="rounded-md bg-[color:var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
      >
        Sign up
      </Link>
    </div>
  );
}
