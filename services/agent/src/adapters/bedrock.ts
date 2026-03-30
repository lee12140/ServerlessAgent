/**
 * Bedrock Model Adapter
 *
 * Wires the agent's LLM calls to AWS Bedrock (Amazon Nova Lite EU).
 * Swap the modelId here to change the AI model for the whole agent.
 */
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: process.env.REGION || 'eu-central-1' });

// EU cross-region inference profile (required in eu-central-1)
const DEFAULT_MODEL_ID = 'eu.amazon.nova-lite-v1:0';

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: { text: string }[];
}

export async function invokeModel(
  messages: BedrockMessage[],
  modelId: string = DEFAULT_MODEL_ID,
  maxTokens = 2000,
): Promise<string> {
  const response = await bedrock.send(new ConverseCommand({
    modelId,
    messages,
    inferenceConfig: {
      maxTokens,
      temperature: 0.7,
    },
  }));

  return response.output?.message?.content?.[0]?.text ?? 'No response.';
}
