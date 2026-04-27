import { fmtUsd } from '../format.js';
import type { EmailParts } from '../send.js';
import { htmlLayout, row, table, textLayout } from './layout.js';

export type UserDepositData = {
  amountCents: bigint;
  newBalanceCents: bigint;
};

export function userDeposit(d: UserDepositData): EmailParts {
  const subject = `${fmtUsd(d.amountCents)} added to your demo balance`;
  const title = 'Demo top-up';
  const bodyHtml = `
    <p>You added <strong>${fmtUsd(d.amountCents)}</strong> to your demo account.</p>
    ${table([
      row('Top-up amount', fmtUsd(d.amountCents)),
      row('New balance', fmtUsd(d.newBalanceCents)),
    ])}
    <p style="color:#a3a3a3;font-size:13px;margin:0;">No real funds involved — this is a demo platform for practicing trading.</p>
  `;
  const bodyText = [
    `You added ${fmtUsd(d.amountCents)} to your demo account.`,
    '',
    `Top-up amount: ${fmtUsd(d.amountCents)}`,
    `New balance:   ${fmtUsd(d.newBalanceCents)}`,
  ].join('\n');
  return {
    subject,
    html: htmlLayout({ preview: `Balance now ${fmtUsd(d.newBalanceCents)}`, title, bodyHtml }),
    text: textLayout({ title, bodyText }),
  };
}
