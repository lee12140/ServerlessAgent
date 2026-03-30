/**
 * DynamoDB Memory Adapter for OpenClaw
 * 
 * Replaces OpenClaw's in-memory state with persistent DynamoDB storage.
 * This is the key piece that makes a stateful agent work on stateless Lambda.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' })
);

export interface AgentState {
  messages: { role: 'user' | 'assistant'; content: string }[];
  context?: Record<string, unknown>;
  updatedAt?: number;
}

export class DynamoMemoryAdapter {
  constructor(private tableName: string) {}

  async load(sessionId: string): Promise<AgentState | null> {
    const result = await dynamo.send(new GetCommand({
      TableName: this.tableName,
      Key: { sessionId },
    }));
    return (result.Item?.agentState as AgentState) ?? null;
  }

  async save(sessionId: string, state: AgentState): Promise<void> {
    await dynamo.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        sessionId,
        agentState: { ...state, updatedAt: Date.now() },
      },
    }));
  }
}
