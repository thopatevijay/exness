import { cookies } from 'next/headers';
import { API_URL } from './env';

export type Session = { userId: string };

/**
 * Server-side session check. Reads the web-origin `token` cookie (set by our
 * /api/auth/signin proxy route after the backend authenticated), then hits the
 * backend's /balance endpoint to confirm the token is still valid.
 */
export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const token = c.get('token')?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/v1/user/balance`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    // We only verify validity here; userId extraction can come later if needed.
    return { userId: 'self' };
  } catch {
    return null;
  }
}
