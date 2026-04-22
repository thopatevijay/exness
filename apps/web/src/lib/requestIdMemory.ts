// Tab-local memory of x-request-ids we originated, so WS order_update echoes
// of our own POSTs can be deduped against locally-fired form toasts.

const TTL_MS = 30_000;
const seen = new Map<string, number>();

export function rememberRequestId(id: string): void {
  seen.set(id, Date.now());
  if (seen.size > 200) {
    const cutoff = Date.now() - TTL_MS;
    for (const [k, t] of seen) if (t < cutoff) seen.delete(k);
  }
}

export function wasLocal(id: string | null | undefined): boolean {
  if (!id) return false;
  const t = seen.get(id);
  return t !== undefined && Date.now() - t < TTL_MS;
}
