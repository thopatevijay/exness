import { env } from '@exness/config';
import { logger } from '@exness/logger';
import { Resend } from 'resend';

export type EmailParts = {
  subject: string;
  html: string;
  text: string;
};

export type SendArgs = EmailParts & { to: string };

const dryRun = env.EMAIL_DRY_RUN === 'true' || env.RESEND_API_KEY === '';
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function send(args: SendArgs): Promise<void> {
  if (dryRun || !resend) {
    logger.info(
      {
        to: args.to,
        subject: args.subject,
        textPreview: args.text.split('\n').slice(0, 4).join(' | '),
        dryRun: true,
      },
      'email (dry-run, not sent)',
    );
    return;
  }

  try {
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    if (result.error) {
      logger.warn(
        { to: args.to, subject: args.subject, err: result.error },
        'resend returned error; email not delivered',
      );
      return;
    }
    logger.info(
      { to: args.to, subject: args.subject, id: result.data?.id },
      'email sent',
    );
  } catch (err) {
    logger.warn({ err, to: args.to, subject: args.subject }, 'resend send failed');
  }
}
