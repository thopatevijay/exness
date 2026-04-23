// Minimal CSV emitter: quotes every cell, escapes internal quotes.
// Good enough for exporting history rows; not a full RFC 4180 impl.

export function toCsv<T extends Record<string, unknown>>(rows: T[], headers: string[]): string {
  const esc = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = headers.map(esc).join(',');
  const body = rows.map((r) => headers.map((h) => esc(r[h])).join(','));
  return [head, ...body].join('\n');
}

export function downloadCsv(name: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}
