/**
 * Bedrock Model Adapter
 *
 * Wires the agent's LLM calls to AWS Bedrock (Amazon Nova Lite EU).
 * Swap the modelId here to change the AI model for the whole agent.
 */
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { ConverseCommandOutput, Message, Tool } from '@aws-sdk/client-bedrock-runtime';

export type { Message };

const bedrock = new BedrockRuntimeClient({ region: process.env.REGION || 'eu-central-1' });

// EU cross-region inference profile — override via MODEL_ID env var
export const DEFAULT_MODEL_ID = process.env['MODEL_ID'] ?? 'eu.amazon.nova-pro-v1:0';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: { json: object };
}

export interface ConverseTurn {
  messages: Message[];
  systemPrompt?: string;
  tools?: ToolDefinition[];
  modelId?: string;
  maxTokens?: number;
}

export async function converse({
  messages,
  systemPrompt,
  tools,
  modelId = DEFAULT_MODEL_ID,
  maxTokens = 4096,
}: ConverseTurn): Promise<ConverseCommandOutput> {
  return bedrock.send(new ConverseCommand({
    modelId,
    messages,
    system: systemPrompt ? [{ text: systemPrompt }] : undefined,
    toolConfig: tools?.length
      ? { tools: tools.map(t => ({ toolSpec: t })) as unknown as Tool[] }
      : undefined,
    inferenceConfig: { maxTokens, temperature: 0.7 },
  }));
}
