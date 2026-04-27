// API_URL is server-side only — read by Next route handlers to call the
// backend over Railway's private network. Not NEXT_PUBLIC so it never
// reaches the client bundle.
export const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8001/stream';
export const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
