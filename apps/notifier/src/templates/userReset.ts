import { fmtUsd } from '../format.js';
import type { EmailParts } from '../send.js';
import { htmlLayout, row, table, textLayout } from './layout.js';

export type UserResetData = {
  newBalanceCents: bigint;
  ordersClosed: number;
  historyDeleted: number;
};

export function userReset(d: UserResetData): EmailParts {
  const subject = `Demo account reset — balance back to ${fmtUsd(d.newBalanceCents)}`;
  const title = 'Demo account reset';
  const bodyHtml = `
    <p>Your demo account has been wiped and the balance reset.</p>
    ${table([
      row('Balance', fmtUsd(d.newBalanceCents)),
      row('Open orders closed', String(d.ordersClosed)),
      row('History rows removed', String(d.historyDeleted)),
    ])}
    <p style="color:#a3a3a3;font-size:13px;margin:0;">Fresh start — happy trading.</p>
  `;
  const bodyText = [
    'Your demo account has been wiped and the balance reset.',
    '',
    `Balance:              ${fmtUsd(d.newBalanceCents)}`,
    `Open orders closed:   ${d.ordersClosed}`,
    `History rows removed: ${d.historyDeleted}`,
  ].join('\n');
  return {
    subject,
    html: htmlLayout({ preview: `Reset to ${fmtUsd(d.newBalanceCents)}`, title, bodyHtml }),
    text: textLayout({ title, bodyText }),
  };
}
