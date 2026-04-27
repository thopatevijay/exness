export function htmlLayout(opts: {
  preview: string;
  title: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#e5e5e5;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0a;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" style="max-width:560px;background:#141414;border:1px solid #262626;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:24px 28px;border-bottom:1px solid #262626;">
            <div style="font-size:14px;letter-spacing:0.06em;color:#888;text-transform:uppercase;">Exness Demo</div>
            <div style="margin-top:6px;font-size:20px;font-weight:600;color:#fafafa;">${escapeHtml(opts.title)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px;font-size:15px;line-height:1.55;color:#d4d4d4;">${opts.bodyHtml}</td>
        </tr>
        <tr>
          <td style="padding:18px 28px;border-top:1px solid #262626;font-size:12px;color:#737373;">
            Demo trading platform — no real funds involved.<br>
            You're receiving this because of an action on your demo account.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function textLayout(opts: { title: string; bodyText: string }): string {
  return `${opts.title.toUpperCase()}
${'='.repeat(opts.title.length)}

${opts.bodyText}

— Exness Demo (no real funds involved)
`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;color:#737373;font-size:13px;">${escapeHtml(label)}</td><td style="padding:6px 0;text-align:right;font-family:'SF Mono',Menlo,monospace;color:#fafafa;font-size:13px;">${escapeHtml(value)}</td></tr>`;
}

export function table(rows: string[]): string {
  return `<table role="presentation" width="100%" style="margin:16px 0;border-top:1px solid #262626;border-bottom:1px solid #262626;">${rows.join('')}</table>`;
}
