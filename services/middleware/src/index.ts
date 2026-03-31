import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const REGION = process.env.REGION || 'eu-central-1';
const lambdaClient = new LambdaClient({ region: REGION });

const MAX_MESSAGE_LENGTH = 4000;

function json(statusCode: number, body: object): APIGatewayProxyResultV2 {
  return { statusCode, body: JSON.stringify(body) };
}

function decodeLambdaPayload<T>(payload: Uint8Array): T {
  const parsed = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
  if (parsed['errorMessage']) throw new Error(parsed['errorMessage'] as string);
  return parsed as T;
}

interface AgentResponse { message: string; sessionId: string; }

async function callAgent(message: string, sessionId: string): Promise<AgentResponse> {
  const result = await lambdaClient.send(new InvokeCommand({
    FunctionName: process.env.AGENT_FUNCTION_NAME,
    Payload: JSON.stringify({ message, sessionId }),
  }));
  return decodeLambdaPayload<AgentResponse>(result.Payload!);
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  console.log('Middleware received:', event.requestContext.http.method, event.rawPath);

  const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  if (apiKey !== process.env.API_KEY) {
    return json(403, { error: 'Forbidden' });
  }

  try {
    if (event.requestContext.http.method !== 'POST' || event.rawPath !== '/webhook') {
      return json(404, { error: 'Not found' });
    }

    const body = event.body ? JSON.parse(event.body) as Record<string, unknown> : {};
    const sessionId = (body['sessionId'] as string | undefined)?.trim() || crypto.randomUUID();
    const userMessage = (body['message'] as string | undefined)?.trim();

    if (!userMessage) return json(400, { error: 'Request body must include "message".' });
    if (userMessage.length > MAX_MESSAGE_LENGTH) {
      return json(400, { error: `Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.` });
    }

    console.log(`Text request: sessionId=${sessionId}, message length=${userMessage.length}`);
    const agentPayload = await callAgent(userMessage, sessionId);

    return json(200, { message: agentPayload.message, sessionId, source: 'text' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Middleware unhandled error:', err);
    return json(500, { error: message });
  }
};
