import type { Symbol } from '@exness/shared';
import { fmtAssetPrice, fmtLeverage, fmtSide, fmtUsd, shortOrderId } from '../format.js';
import type { EmailParts } from '../send.js';
import { htmlLayout, row, table, textLayout } from './layout.js';

export type OrderOpenedData = {
  asset: Symbol;
  side: 'buy' | 'sell';
  marginCents: bigint;
  leverage: number;
  openPrice: bigint;
  orderId: string;
};

export function orderOpened(d: OrderOpenedData): EmailParts {
  const sideLabel = fmtSide(d.side);
  const subject = `${sideLabel} ${d.asset} opened — ${fmtUsd(d.marginCents)} @ ${fmtLeverage(d.leverage)}`;
  const title = 'Position opened';

  const bodyHtml = `
    <p>Your <strong>${sideLabel}</strong> position on <strong>${d.asset}</strong> is now open.</p>
    ${table([
      row('Order ID', shortOrderId(d.orderId)),
      row('Side', sideLabel),
      row('Asset', d.asset),
      row('Margin', fmtUsd(d.marginCents)),
      row('Leverage', fmtLeverage(d.leverage)),
      row('Open price', fmtAssetPrice(d.openPrice, d.asset)),
    ])}
    <p style="color:#a3a3a3;font-size:13px;margin:0;">You'll get another email when this position closes — manually, by SL/TP, or via liquidation.</p>
  `;

  const bodyText = [
    `Your ${sideLabel} position on ${d.asset} is now open.`,
    '',
    `Order ID:    ${shortOrderId(d.orderId)}`,
    `Side:        ${sideLabel}`,
    `Asset:       ${d.asset}`,
    `Margin:      ${fmtUsd(d.marginCents)}`,
    `Leverage:    ${fmtLeverage(d.leverage)}`,
    `Open price:  ${fmtAssetPrice(d.openPrice, d.asset)}`,
  ].join('\n');

  return {
    subject,
    html: htmlLayout({ preview: `${sideLabel} ${d.asset} @ ${fmtAssetPrice(d.openPrice, d.asset)}`, title, bodyHtml }),
    text: textLayout({ title, bodyText }),
  };
}
