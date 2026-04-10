import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { UserGateway } from './gateways/users.js';
import { json } from './utils/http.js';

export interface AuthResult {
  userId: string;
}

export async function validateApiKey(
  event: APIGatewayProxyEventV2,
  users: UserGateway
): Promise<AuthResult | APIGatewayProxyStructuredResultV2> {
  // Check both header casings — API Gateway may normalise to lowercase
  const apiKey = event.headers['x-api-key'] ?? event.headers['X-API-Key'];
  if (!apiKey) return json(403, { error: 'Forbidden', code: 'FORBIDDEN' });

  // Resolve the key to a user record in DynamoDB
  const resolved = await users.resolve(apiKey);
  if (!resolved || !resolved.active) return json(403, { error: 'Forbidden', code: 'FORBIDDEN' });

  return { userId: resolved.userId };
}
