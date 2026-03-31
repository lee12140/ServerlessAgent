import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const REGION = process.env.REGION || 'eu-central-1';
const lambdaClient = new LambdaClient({ region: REGION });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const TABLE_NAME = process.env.TABLE_NAME!;
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

/**
 * POST /webhook — accepts text or audio messages.
 * Audio: invokes transcriber async, returns { jobId, status: 'processing' }.
 * Text:  calls agent synchronously, returns { message }.
 */
async function handleWebhook(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const body = event.body ? JSON.parse(event.body) as Record<string, unknown> : {};
  const sessionId = (body['sessionId'] as string | undefined)?.trim() || crypto.randomUUID();

  // --- Audio path (async) ---
  if (body['audio']) {
    const jobId = crypto.randomUUID();
    console.log(`Audio request: jobId=${jobId}, sessionId=${sessionId}`);

    await lambdaClient.send(new InvokeCommand({
      FunctionName: process.env.TRANSCRIBE_FUNCTION_NAME,
      InvocationType: 'Event', // async — fire and forget
      Payload: JSON.stringify({ audio: body['audio'], sessionId, jobId }),
    }));

    return json(202, { jobId, sessionId, status: 'processing' });
  }

  // --- Text path (sync) ---
  let userMessage = (body['message'] as string | undefined)?.trim();

  if (!userMessage) return json(400, { error: 'Request body must include "message" or "audio".' });
  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    return json(400, { error: `Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.` });
  }

  console.log(`Text request: sessionId=${sessionId}, message length=${userMessage.length}`);
  const agentPayload = await callAgent(userMessage, sessionId);

  return json(200, { message: agentPayload.message, sessionId, source: 'text' });
}

/**
 * GET /status/{jobId} — polls the transcription job and, once ready, calls the agent.
 *
 * States:  pending → (transcriber running)
 *          transcribed → transcript ready, agent not yet called
 *          completed → agent response stored
 *          failed → transcription or agent error
 */
async function handleStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const jobId = event.pathParameters?.['jobId'];
  if (!jobId) return json(400, { error: 'Missing jobId' });

  const key = `transcription#${jobId}`;

  const result = await dynamo.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { sessionId: key },
  }));

  const item = result.Item;
  if (!item) return json(404, { error: 'Job not found or expired.' });

  const status = item['status'] as string;

  if (status === 'completed') {
    return json(200, { status: 'completed', message: item['agentMessage'], sessionId: item['sessionId_user'] as string });
  }

  if (status === 'failed') {
    return json(200, { status: 'failed', error: item['error'] });
  }

  if (status === 'transcribed') {
    // Atomically claim this job so concurrent polls don't double-invoke the agent
    try {
      await dynamo.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { sessionId: key },
        UpdateExpression: 'SET #s = :calling',
        ConditionExpression: '#s = :transcribed',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':calling': 'calling_agent', ':transcribed': 'transcribed' },
      }));
    } catch {
      // Another request already claimed it — return processing
      return json(200, { status: 'processing' });
    }

    try {
      const transcript = item['transcript'] as string;
      const userSessionId = item['userSessionId'] as string;
      const agentPayload = await callAgent(transcript, userSessionId);

      await dynamo.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { sessionId: key },
        UpdateExpression: 'SET #s = :completed, agentMessage = :msg, sessionId_user = :sid',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':completed': 'completed',
          ':msg': agentPayload.message,
          ':sid': agentPayload.sessionId,
        },
      }));

      return json(200, {
        status: 'completed',
        message: `Transcription: ${transcript}\n\nAnswer: ${agentPayload.message}`,
        sessionId: agentPayload.sessionId,
        source: 'voice',
      });
    } catch (err: any) {
      await dynamo.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { sessionId: key },
        UpdateExpression: 'SET #s = :failed, #e = :err',
        ExpressionAttributeNames: { '#s': 'status', '#e': 'error' },
        ExpressionAttributeValues: { ':failed': 'failed', ':err': err.message },
      }));
      return json(200, { status: 'failed', error: err.message });
    }
  }

  // status === 'pending' or 'calling_agent'
  return json(200, { status: 'processing' });
}

/**
 * Main handler — routes by HTTP method + path.
 */
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  console.log('Middleware received:', event.requestContext.http.method, event.rawPath);

  // Auth check
  const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  if (apiKey !== process.env.API_KEY) {
    return json(403, { error: 'Forbidden' });
  }

  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath;

    if (method === 'POST' && path === '/webhook') return handleWebhook(event);
    if (method === 'GET'  && path.startsWith('/status/')) return handleStatus(event);

    return json(404, { error: 'Not found' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Middleware unhandled error:', err);
    return json(500, { error: message });
  }
};
