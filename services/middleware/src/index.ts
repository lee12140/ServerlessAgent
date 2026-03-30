import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const lambda = new LambdaClient({ region: process.env.REGION || 'eu-central-1' });

function json(statusCode: number, body: object): APIGatewayProxyResultV2 {
    return { statusCode, body: JSON.stringify(body) };
}

function decodeLambdaPayload<T>(payload: Uint8Array): T {
    const parsed = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
    if (parsed['errorMessage']) throw new Error(parsed['errorMessage'] as string);
    return parsed as T;
}

interface TranscriberResponse { text: string; }
interface AgentResponse { message: string; sessionId: string; }

/**
 * Middleware Handler (The Orchestrator)
 * Responsibility: Receive request, check for audio/text, invoke specialists.
 */
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    console.log('Middleware received:', JSON.stringify(event));

    // 1. Security: Check API Key
    const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
    if (apiKey !== process.env.API_KEY) {
        return json(403, { error: 'Forbidden' });
    }

    try {
        // 2. Parse Body
        const body = event.body ? JSON.parse(event.body) as Record<string, unknown> : {};
        let userMessage = body['message'] as string | undefined;
        const sessionId = (body['sessionId'] as string | undefined) ?? 'default';

        // 3. Handle Audio (if present)
        if (body['audio']) {
            console.log('Audio detected, invoking Transcriber...');
            const transcribeResult = await lambda.send(new InvokeCommand({
                FunctionName: process.env.TRANSCRIBE_FUNCTION_NAME,
                Payload: JSON.stringify({ audio: body['audio'], sessionId }),
            }));

            const { text } = decodeLambdaPayload<TranscriberResponse>(transcribeResult.Payload!);
            userMessage = text || '(Silence or unintelligible audio)';
            console.log('Transcription result:', userMessage);
        }

        // 4. Call Agent
        console.log('Calling Agent with message:', userMessage);
        const agentResult = await lambda.send(new InvokeCommand({
            FunctionName: process.env.AGENT_FUNCTION_NAME,
            Payload: JSON.stringify({ message: userMessage || 'Hello', sessionId }),
        }));

        const agentPayload = decodeLambdaPayload<AgentResponse>(agentResult.Payload!);

        // 5. Build Response (include transcription if audio was used)
        const finalMessage = body['audio']
            ? `Translation: ${userMessage}\n\nAnswer: ${agentPayload.message}`
            : agentPayload.message;

        return json(200, {
            message: finalMessage,
            sessionId: agentPayload.sessionId,
            source: body['audio'] ? 'voice' : 'text',
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        console.error('Middleware unhandled error:', err);
        return json(500, { error: message });
    }
};
