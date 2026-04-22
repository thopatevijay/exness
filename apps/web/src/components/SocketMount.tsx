'use client';

import { useExnessSocket } from '@/hooks/useExnessSocket';

export function SocketMount(): null {
  useExnessSocket();
  return null;
}
