import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const REGION = process.env.REGION || 'eu-central-1';
const lambdaClient = new LambdaClient({ region: REGION });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3 = new S3Client({ region: REGION });

const TABLE_NAME   = process.env.TABLE_NAME!;
const AUDIO_BUCKET = process.env.AUDIO_BUCKET!;

// Keep well under the API Gateway HTTP API 29-second hard timeout.
const MAX_AUDIO_BASE64_BYTES = 200_000; // ~150KB decoded — safe for async Lambda payload
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
 * POST /webhook
 *
 * Text path:  calls agent synchronously, returns response.
 * Audio path: uploads audio to S3 (avoids 256KB async payload limit),
 *             invokes transcriber async with S3 key, returns jobId immediately.
 */
async function handleWebhook(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const body = event.body ? JSON.parse(event.body) as Record<string, unknown> : {};
  const sessionId = (body['sessionId'] as string | undefined)?.trim() || crypto.randomUUID();

  // --- Audio path (async) ---
  if (body['audio']) {
    const audioBase64 = body['audio'] as string;

    // Guard against payloads too large for async Lambda invocation (256KB limit)
    if (audioBase64.length > MAX_AUDIO_BASE64_BYTES) {
      return json(413, { error: `Audio too large. Maximum is ~150KB decoded (~${MAX_AUDIO_BASE64_BYTES} base64 chars). Please send shorter clips.` });
    }

    const jobId = crypto.randomUUID();
    const s3Key = `audio/${sessionId}-${jobId}.webm`;

    // Pre-upload audio to S3 so the transcriber payload stays tiny
    await s3.send(new PutObjectCommand({
      Bucket: AUDIO_BUCKET,
      Key: s3Key,
      Body: Buffer.from(audioBase64, 'base64'),
      ContentType: 'audio/webm',
    }));

    console.log(`Audio upload: jobId=${jobId}, sessionId=${sessionId}, s3Key=${s3Key}`);

    await lambdaClient.send(new InvokeCommand({
      FunctionName: process.env.TRANSCRIBE_FUNCTION_NAME,
      InvocationType: 'Event', // async — fire and forget
      Payload: JSON.stringify({ s3Key, sessionId, jobId }),
    }));

    return json(202, { jobId, sessionId, status: 'processing' });
  }

  // --- Text path (sync) ---
  const userMessage = (body['message'] as string | undefined)?.trim();

  if (!userMessage) return json(400, { error: 'Request body must include "message" or "audio".' });
  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    return json(400, { error: `Message too long. Maximum is ${MAX_MESSAGE_LENGTH} characters.` });
  }

  console.log(`Text request: sessionId=${sessionId}, messageLength=${userMessage.length}`);
  const agentPayload = await callAgent(userMessage, sessionId);

  return json(200, { message: agentPayload.message, sessionId, source: 'text' });
}

/**
 * GET /status/{jobId}
 *
 * States:
 *   transcribed   → transcript ready, agent not yet called
 *   calling_agent → agent call in progress (claimed atomically)
 *   completed     → full response ready
 *   failed        → transcription or agent error
 *   (anything else) → still processing
 */
async function handleStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const jobId = event.pathParameters?.['jobId'];
  if (!jobId) return json(400, { error: 'Missing jobId' });

  const key = `transcription#${jobId}`;
  const result = await dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { sessionId: key } }));

  const item = result.Item;
  if (!item) return json(404, { error: 'Job not found or expired.' });

  const status = item['status'] as string;

  if (status === 'completed') {
    return json(200, { status: 'completed', message: item['agentMessage'], sessionId: item['sessionId_user'] });
  }

  if (status === 'failed') {
    return json(200, { status: 'failed', error: item['error'] });
  }

  if (status === 'transcribed') {
    // Atomic claim — prevents double agent invocation on concurrent polls
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
      return json(200, { status: 'processing' });
    }

    try {
      const transcript    = item['transcript'] as string;
      const userSessionId = item['userSessionId'] as string;
      const agentPayload  = await callAgent(transcript, userSessionId);

      await dynamo.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { sessionId: key },
        UpdateExpression: 'SET #s = :done, agentMessage = :msg, sessionId_user = :sid',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':done': 'completed', ':msg': agentPayload.message, ':sid': agentPayload.sessionId },
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

  return json(200, { status: 'processing' });
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  // Log metadata only — never log body content (contains user messages / audio)
  console.log(`${event.requestContext.http.method} ${event.rawPath}`);

  const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  if (apiKey !== process.env.API_KEY) return json(403, { error: 'Forbidden' });

  try {
    const method = event.requestContext.http.method;
    const path   = event.rawPath;

    if (method === 'POST' && path === '/webhook')      return handleWebhook(event);
    if (method === 'GET'  && path.startsWith('/status/')) return handleStatus(event);

    return json(404, { error: 'Not found' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Middleware error:', message);
    return json(500, { error: message });
  }
};
