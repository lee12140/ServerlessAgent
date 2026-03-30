import { DynamoMemoryAdapter, type AgentState } from './adapters/dynamo-memory.js';
import { converse, DEFAULT_MODEL_ID } from './adapters/bedrock.js';
import type { Message } from './adapters/bedrock.js';
import { getTimeDefinition, getTime } from './skills/get-time.js';
import { createMeetingDefinition, createMeeting } from './skills/calendar.js';
import { researchDefinition, webSearch } from './skills/research.js';

const MODEL_ID = process.env.MODEL_ID || DEFAULT_MODEL_ID;
const MAX_ITERATIONS = 5;

const memory = new DynamoMemoryAdapter(process.env.TABLE_NAME!);

const SYSTEM_PROMPT = `You are a professional Executive Personal Assistant. Your goal is to manage the user's schedule and information with extreme professionalism and proactivity.

CORE DIRECTIVES:
1. TOOL USE: You MUST use tools to fulfill requests. Never explain how to do something manually if a tool exists.
2. DATE VERIFICATION: Before scheduling ANY meeting, you MUST call 'get_current_time' to ensure you have the correct date and year.
3. PROACTIVITY: If a user specifies a start time but no duration, assume 1 hour. Default to 'Europe/Berlin' timezone unless otherwise specified.
4. TONE: Be professional, concise, and helpful. Act like a high-level executive assistant.
5. NO HALLUCINATION: Always use the exact data returned by tools in your confirmations.`;

const TOOLS = [
  getTimeDefinition,
  createMeetingDefinition,
  researchDefinition,
];

const TOOL_IMPLEMENTATIONS: Record<string, (input: unknown) => string | Promise<string>> = {
  get_current_time: () => getTime(),
  create_calendar_meeting: (input) => createMeeting(input as Parameters<typeof createMeeting>[0]),
  web_search: (input) => webSearch(input as Parameters<typeof webSearch>[0]),
};

console.log(`Agent Initialization [v${process.env.CODE_VERSION || 'local'}] - Tools:`, TOOLS.map(t => t.name).join(', '));

// Strip internal <thinking>...</thinking> blocks from the model's reply.
// Nova Lite exposes its reasoning process in these tags — users shouldn't see it.
function stripThinking(text: string): string {
  return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
}

function buildMessages(savedState: AgentState, userMessage: string): Message[] {
  return [
    ...savedState.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: [{ text: m.content }],
    })),
    { role: 'user' as const, content: [{ text: userMessage }] },
  ];
}

// Runs the ReAct loop (think → act → observe) and returns the final text response,
// or null if the loop exhausted all iterations without reaching end_turn.
async function executeReActLoop(messages: Message[]): Promise<string | null> {
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await converse({
      messages,
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      modelId: MODEL_ID,
    });

    if (response.stopReason === 'end_turn') {
      const raw = response.output?.message?.content?.[0]?.text ?? '';
      return stripThinking(raw);
    }

    if (response.stopReason === 'tool_use') {
      const toolUseBlock = response.output?.message?.content?.find(b => 'toolUse' in b);
      if (!toolUseBlock || !('toolUse' in toolUseBlock)) break;

      const { toolUseId, name, input } = toolUseBlock.toolUse!;
      console.log(`Agent calling tool: ${name}`);

      messages.push({ role: 'assistant', content: response.output!.message!.content! } as Message);

      const toolResult = await TOOL_IMPLEMENTATIONS[name!]?.(input) ?? 'Tool not found.';
      messages.push({
        role: 'user',
        content: [{
          toolResult: {
            toolUseId,
            content: [{ text: toolResult as string }],
          },
        }],
      } as unknown as Message);
    }
  }

  return null;
}

export async function runAgentTurn(sessionId: string, userMessage: string): Promise<string> {
  const savedState: AgentState = (await memory.load(sessionId)) ?? { messages: [] };
  const messages = buildMessages(savedState, userMessage);

  const finalResponse = await executeReActLoop(messages);

  if (finalResponse === null) {
    console.warn(`Agent loop exhausted for session ${sessionId} without a final response.`);
    return 'I could not complete the task.';
  }

  const updatedState: AgentState = {
    messages: [
      ...savedState.messages,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: finalResponse },
    ],
  };
  await memory.save(sessionId, updatedState);

  return finalResponse;
}
