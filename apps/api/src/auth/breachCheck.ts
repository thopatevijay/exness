import crypto from 'node:crypto';

export type BreachResult = { breached: boolean; count: number };

export async function isBreached(password: string): Promise<BreachResult> {
  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: AbortSignal.timeout(2_000),
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return { breached: false, count: 0 };
    const text = await res.text();
    for (const line of text.split('\n')) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix === suffix) {
        // eslint-disable-next-line no-restricted-syntax -- HIBP wire format: string count, not monetary
        return { breached: true, count: parseInt(countStr ?? '0', 10) };
      }
    }
    return { breached: false, count: 0 };
  } catch {
    return { breached: false, count: 0 };
  }
}
