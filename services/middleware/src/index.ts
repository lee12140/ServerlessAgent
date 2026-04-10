import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { validateApiKey } from './auth.js';
import { route } from './router.js';
import { LambdaAgentGateway } from './gateways/agent.js';
import { DynamoUserGateway } from './gateways/users.js';
import { json } from './utils/http.js';

// Instantiated once per container (cold start) — not per request
const agent = new LambdaAgentGateway();
const users = new DynamoUserGateway();

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  console.log('Middleware received:', event.requestContext.http.method, event.rawPath);

  try {
    // Validate the API key and resolve it to a userId
    // If auth fails, validateApiKey returns a response object directly (403)
    const auth = await validateApiKey(event, users);
    if (!('userId' in auth)) return auth;

    return route(event, auth.userId, { agent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Middleware unhandled error:', err);
    return json(500, { error: message, code: 'INTERNAL_ERROR' });
  }
};
