import type { Symbol } from '@exness/shared';
import { fmtAssetPrice, fmtSide, fmtSignedUsd, shortOrderId } from '../format.js';
import type { EmailParts } from '../send.js';
import { htmlLayout, row, table, textLayout } from './layout.js';

export type CloseReason = 'manual' | 'sl' | 'tp' | 'liquidation';

export type OrderClosedData = {
  asset: Symbol;
  side: 'buy' | 'sell';
  closePrice: bigint;
  pnlCents: bigint;
  reason: CloseReason;
  orderId: string;
};

const REASON_LABEL: Record<CloseReason, string> = {
  manual: 'Manual close',
  sl: 'Stop loss',
  tp: 'Take profit',
  liquidation: 'Liquidation',
};

const REASON_TONE: Record<CloseReason, string> = {
  manual: '#fafafa',
  tp: '#34d399',
  sl: '#fbbf24',
  liquidation: '#f87171',
};

export function orderClosed(d: OrderClosedData): EmailParts {
  const sideLabel = fmtSide(d.side);
  const reasonLabel = REASON_LABEL[d.reason];
  const pnlText = fmtSignedUsd(d.pnlCents);
  const subject = `${reasonLabel}: ${sideLabel} ${d.asset} closed at ${pnlText}`;
  const title = `${reasonLabel} — ${pnlText}`;

  const pnlColor = d.pnlCents >= 0n ? '#34d399' : '#f87171';
  const reasonColor = REASON_TONE[d.reason];

  const bodyHtml = `
    <p>Your <strong>${sideLabel}</strong> position on <strong>${d.asset}</strong> has been closed.</p>
    <div style="margin:18px 0;padding:14px 16px;background:#0a0a0a;border:1px solid ${reasonColor}33;border-radius:8px;">
      <div style="font-size:12px;color:${reasonColor};text-transform:uppercase;letter-spacing:0.06em;">${reasonLabel}</div>
      <div style="margin-top:4px;font-size:24px;font-weight:600;color:${pnlColor};">${pnlText}</div>
    </div>
    ${table([
      row('Order ID', shortOrderId(d.orderId)),
      row('Side', sideLabel),
      row('Asset', d.asset),
      row('Close price', fmtAssetPrice(d.closePrice, d.asset)),
      row('Realized P&L', pnlText),
      row('Close reason', reasonLabel),
    ])}
  `;

  const bodyText = [
    `Your ${sideLabel} position on ${d.asset} has been closed.`,
    '',
    `${reasonLabel}: ${pnlText}`,
    '',
    `Order ID:     ${shortOrderId(d.orderId)}`,
    `Side:         ${sideLabel}`,
    `Asset:        ${d.asset}`,
    `Close price:  ${fmtAssetPrice(d.closePrice, d.asset)}`,
    `Realized P&L: ${pnlText}`,
    `Reason:       ${reasonLabel}`,
  ].join('\n');

  return {
    subject,
    html: htmlLayout({
      preview: `${reasonLabel}: ${sideLabel} ${d.asset} ${pnlText}`,
      title,
      bodyHtml,
    }),
    text: textLayout({ title, bodyText }),
  };
}
