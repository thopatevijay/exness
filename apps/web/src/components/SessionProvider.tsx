'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';

export type ClientSession = { authed: true } | { authed: false };

const SessionContext = createContext<ClientSession>({ authed: false });

// Access tokens are 15m. Refresh ~2m before expiry so a brief network blip
// doesn't drop the user. setInterval is sufficient — we only run while the
// tab is mounted, and a missed refresh just falls back to the user signing
// in again on next request.
const REFRESH_INTERVAL_MS = 13 * 60 * 1000;

export function SessionProvider({
  authed,
  children,
}: {
  authed: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!authed) return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (res.status === 401) {
          stopped = true;
        }
      } catch {
        // Network blip — try again on next tick.
      }
    };
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authed]);

  return (
    <SessionContext.Provider value={authed ? { authed: true } : { authed: false }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): ClientSession {
  return useContext(SessionContext);
}
