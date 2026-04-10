import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { AgentGateway } from '../gateways/agent.js';
import { MAX_MESSAGE_LENGTH, parseTextRequest } from '../models/requests.js';
import { json, extractBody } from '../utils/http.js';

export async function handleText(
  event: APIGatewayProxyEventV2,
  userId: string,
  agent: AgentGateway
): Promise<APIGatewayProxyResultV2> {
  // Parse the raw body — null means missing or malformed JSON
  const body = extractBody(event.body);
  if (!body) return json(400, { error: 'Request body must be valid JSON.', code: 'INVALID_CONTENT_TYPE' });

  // Validate the parsed body into a typed TextRequest
  const parsed = parseTextRequest(body);
  if (typeof parsed === 'string') {
    const messages: Record<string, string> = {
      MESSAGE_REQUIRED: 'Request body must include "message".',
      MESSAGE_TOO_LONG: `Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`,
    };
    return json(400, { error: messages[parsed] ?? parsed, code: parsed });
  }

  // Call the agent with the resolved userId from auth
  const agentResponse = await agent.call(parsed.message, parsed.sessionId, userId);

  return json(200, {
    message: agentResponse.message,
    sessionId: parsed.sessionId,
    requestId: event.requestContext.requestId,
  });
}
