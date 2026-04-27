import type { Redis } from 'ioredis';

export async function consumeTicket(
  url: string | undefined,
  redis: Redis,
): Promise<string | null> {
  if (!url) return null;
  const params = new URL(url, 'http://localhost').searchParams;
  const ticket = params.get('ticket');
  if (!ticket) return null;
  const userId = (await redis.getdel(`ws-ticket:${ticket}`)) as string | null;
  return userId;
}
