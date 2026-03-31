import type { Skill } from './types.js';
import { google } from 'googleapis';

async function sendEmail(input: { to: string; subject: string; body: string }): Promise<string> {
  const { to, subject, body } = input;

  const authEmail   = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const authKey     = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const senderEmail = process.env.GMAIL_SENDER_EMAIL;

  if (!authEmail || !authKey || !senderEmail) {
    return `Cannot send email: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GMAIL_SENDER_EMAIL must be set. Sending also requires domain-wide delegation enabled in Google Workspace Admin.`;
  }

  try {
    const auth = new google.auth.JWT(authEmail, undefined, authKey, ['https://www.googleapis.com/auth/gmail.send'], senderEmail);
    const gmail = google.gmail({ version: 'v1', auth });

    const raw = Buffer.from(
      [`From: ${senderEmail}`, `To: ${to}`, `Subject: ${subject}`, `Content-Type: text/plain; charset=utf-8`, '', body].join('\n')
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    return `Email sent to ${to} with subject "${subject}".`;
  } catch (error: any) {
    console.error('[SendEmail ERROR]:', error.message);
    return `Failed to send email: ${error.message}`;
  }
}

export const sendEmailSkill: Skill = {
  definition: {
    name: 'send_email',
    description: "Send an email via Gmail on behalf of the user.",
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          to:      { type: 'string', description: "Recipient email address" },
          subject: { type: 'string', description: "Email subject" },
          body:    { type: 'string', description: "Plain text email body" },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  execute: (input) => sendEmail(input as { to: string; subject: string; body: string }),
};
