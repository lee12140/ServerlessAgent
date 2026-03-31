/**
 * Secrets Adapter
 *
 * Fetches sensitive credentials from AWS Secrets Manager once at cold start
 * and injects them into process.env so all existing skill code works unchanged.
 *
 * Secret name: ServerlessAgent/credentials
 * Expected JSON shape:
 * {
 *   "GOOGLE_SERVICE_ACCOUNT_EMAIL": "...",
 *   "GOOGLE_PRIVATE_KEY": "...",
 *   "GOOGLE_CALENDAR_ID": "...",
 *   "GMAIL_SENDER_EMAIL": "...",
 *   "WEATHER_API_KEY": "..."
 * }
 *
 * Create the secret once via AWS CLI:
 *   aws secretsmanager create-secret \
 *     --name ServerlessAgent/credentials \
 *     --region eu-central-1 \
 *     --secret-string '{"GOOGLE_SERVICE_ACCOUNT_EMAIL":"...","GOOGLE_PRIVATE_KEY":"...",...}'
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.REGION || 'eu-central-1' });

let loaded = false;

export async function loadSecrets(): Promise<void> {
  if (loaded) return;

  const secretName = process.env.SECRET_NAME;
  if (!secretName) {
    console.warn('[Secrets] SECRET_NAME not set — skipping Secrets Manager. Falling back to env vars.');
    loaded = true;
    return;
  }

  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    const secrets = JSON.parse(response.SecretString ?? '{}') as Record<string, string>;

    for (const [key, value] of Object.entries(secrets)) {
      if (value && !process.env[key]) {
        process.env[key] = value;
      }
    }

    console.log('[Secrets] Loaded credentials from Secrets Manager.');
  } catch (error: any) {
    // Don't crash — skills will degrade gracefully with their own missing-credential messages
    console.error('[Secrets] Failed to load from Secrets Manager:', error.message);
  }

  loaded = true;
}
