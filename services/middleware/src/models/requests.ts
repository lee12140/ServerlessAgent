export const MAX_MESSAGE_LENGTH = 4000;

export interface TextRequest {
  message: string;   // required, max MAX_MESSAGE_LENGTH chars
  sessionId: string; // defaulted to UUID if absent in body
  // userId is NOT part of the request body — resolved from the API key in auth.ts
}



// Parses and validates the raw request body into a TextRequest.
// Returns a TextRequest on success, or an error code string on failure.
export function parseTextRequest(body: Record<string, unknown>): TextRequest | string {
  const raw = body['message'];
  if (typeof raw !== 'string' || raw.trim() === '') return 'MESSAGE_REQUIRED';

  const message = raw.trim();
  if (message.length > MAX_MESSAGE_LENGTH) return 'MESSAGE_TOO_LONG';

  const rawSession = body['sessionId'];
  const sessionId = typeof rawSession === 'string' && rawSession.trim() !== ''
    ? rawSession.trim()
    : crypto.randomUUID();

  return { message, sessionId };
}
