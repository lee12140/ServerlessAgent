import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { decodeLambdaPayload } from '../utils/decode.js';
import type { AgentResponse } from '../models/responses.js';

const REGION = process.env.REGION ?? 'eu-central-1';
const AGENT_FUNCTION_NAME = process.env.AGENT_FUNCTION_NAME;
if (!AGENT_FUNCTION_NAME) throw new Error('AGENT_FUNCTION_NAME env var is not set');

export type { AgentResponse };

export interface AgentGateway {
  call(message: string, sessionId: string, userId: string): Promise<AgentResponse>;
}

export class LambdaAgentGateway implements AgentGateway {
  private readonly client: LambdaClient;

  constructor() {
    this.client = new LambdaClient({ region: REGION });
  }

  // Invokes the Agent Lambda and returns its response.
  async call(message: string, sessionId: string, userId: string): Promise<AgentResponse> {
    const result = await this.client.send(new InvokeCommand({
      FunctionName: AGENT_FUNCTION_NAME,
      Payload: JSON.stringify({ message, sessionId, userId }),
    }));

    return decodeLambdaPayload<AgentResponse>(result.Payload!);
  }
}
