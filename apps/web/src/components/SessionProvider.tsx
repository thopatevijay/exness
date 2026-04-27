'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type ClientSession = { authed: true } | { authed: false };

const SessionContext = createContext<ClientSession>({ authed: false });

export function SessionProvider({
  authed,
  children,
}: {
  authed: boolean;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={authed ? { authed: true } : { authed: false }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): ClientSession {
  return useContext(SessionContext);
}
