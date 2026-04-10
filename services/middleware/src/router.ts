import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { AgentGateway } from './gateways/agent.js';
import { handleText } from './handlers/text.js';
import { json } from './utils/http.js';

interface Gateways {
  agent: AgentGateway;
}

export async function route(
  event: APIGatewayProxyEventV2,
  userId: string,
  gateways: Gateways
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  // Match method + path to the correct handler
  if (method === 'POST' && path === '/webhook') {
    return handleText(event, userId, gateways.agent);
  }

  return json(404, { error: 'Not found', code: 'NOT_FOUND' });
}
