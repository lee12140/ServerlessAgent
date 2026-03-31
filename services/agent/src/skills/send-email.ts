/**
 * Skill: Send Email
 * Sends an email via the Gmail API using a Google Service Account.
 * Requires domain-wide delegation enabled on the service account in Google Workspace Admin,
 * and GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY + GMAIL_SENDER_EMAIL env vars.
 */

export const sendEmailDefinition = {
  name: 'send_email',
  description: "Send an email on behalf of the user via Gmail. Use when the user asks to send, write, or draft an email.",
  inputSchema: {
    json: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: "Recipient email address",
        },
        subject: {
          type: 'string',
          description: "Email subject line",
        },
        body: {
          type: 'string',
          description: "Plain text body of the email",
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
};

import { google } from 'googleapis';

interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail(input: SendEmailInput): Promise<string> {
  const { to, subject, body } = input;

  const authEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const authKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const senderEmail = process.env.GMAIL_SENDER_EMAIL;

  if (!authEmail || !authKey || !senderEmail) {
    return `Cannot send email: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GMAIL_SENDER_EMAIL must be set. Note: sending email also requires domain-wide delegation enabled on the service account in Google Workspace Admin.`;
  }

  try {
    // Impersonate the sender via domain-wide delegation
    const auth = new google.auth.JWT(
      authEmail,
      undefined,
      authKey,
      ['https://www.googleapis.com/auth/gmail.send'],
      senderEmail  // subject: the user to impersonate
    );

    const gmail = google.gmail({ version: 'v1', auth });

    // Build RFC 2822 message and base64url-encode it
    const message = [
      `From: ${senderEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      body,
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    return `Email sent successfully to ${to} with subject "${subject}".`;
  } catch (error: any) {
    console.error('[SendEmail ERROR]:', error.message);
    return `Failed to send email: ${error.message}`;
  }
}
