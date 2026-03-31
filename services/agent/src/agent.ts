import { DynamoMemoryAdapter, type AgentState } from './adapters/dynamo-memory.js';
import { converse, DEFAULT_MODEL_ID } from './adapters/bedrock.js';
import type { Message } from './adapters/bedrock.js';
import { loadSecrets } from './adapters/secrets.js';
import { skills } from './skills/index.js';

const MODEL_ID   = process.env.MODEL_ID || DEFAULT_MODEL_ID;
const MAX_ITERATIONS = 8;

const memory = new DynamoMemoryAdapter(process.env.TABLE_NAME!);

// Build tool list and dispatch table directly from the skill registry.
// To add a skill: edit skills/index.ts only — nothing here changes.
const TOOLS = skills.map(s => s.definition);
const TOOL_IMPLEMENTATIONS = Object.fromEntries(skills.map(s => [s.definition.name, s.execute.bind(s)]));

const SYSTEM_PROMPT = `You are a professional Executive Personal Assistant. Your goal is to manage the user's schedule, information, and daily tasks with extreme professionalism and proactivity.

CORE DIRECTIVES:
1. TOOL USE: You MUST use tools to fulfill requests. Never explain how to do something manually if a tool exists.
2. DATE VERIFICATION: Before scheduling ANY meeting, call 'get_current_time' to confirm the correct date and year.
3. PROACTIVITY: If a start time is given but no duration, assume 1 hour. Default timezone is 'Europe/Berlin'.
4. TONE: Professional, concise, helpful. Act like a high-level executive assistant.
5. NO HALLUCINATION: Always use the exact data returned by tools in your responses.
6. CALCULATIONS: Always use the 'calculate' tool for any arithmetic — never compute numbers yourself.
7. NOTES: Use 'set_note' / 'get_note' to persist information the user wants to remember.
8. EXPENSES: Use 'log_expense' / 'get_expenses' to track spending when the user mentions purchases.`;

console.log(`Agent [v${process.env.CODE_VERSION || 'local'}] — ${TOOLS.length} skills: ${TOOLS.map(t => t.name).join(', ')}`);

// Strip <thinking>...</thinking> blocks exposed by Nova's reasoning process.
function stripThinking(text: string): string {
  return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
}

function buildMessages(state: AgentState, userMessage: string): Message[] {
  return [
    ...state.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: [{ text: m.content }],
    })),
    { role: 'user' as const, content: [{ text: userMessage }] },
  ];
}

async function executeReActLoop(messages: Message[]): Promise<string | null> {
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await converse({ messages, systemPrompt: SYSTEM_PROMPT, tools: TOOLS, modelId: MODEL_ID });

    if (response.stopReason === 'end_turn') {
      return stripThinking(response.output?.message?.content?.[0]?.text ?? '');
    }

    if (response.stopReason === 'tool_use') {
      const toolBlock = response.output?.message?.content?.find(b => 'toolUse' in b);
      if (!toolBlock || !('toolUse' in toolBlock)) break;

      const { toolUseId, name, input } = toolBlock.toolUse!;
      console.log(`Tool call: ${name}`);

      messages.push({ role: 'assistant', content: response.output!.message!.content! } as Message);

      const result = await (TOOL_IMPLEMENTATIONS[name!]?.(input) ?? Promise.resolve('Tool not found.'));
      messages.push({
        role: 'user',
        content: [{ toolResult: { toolUseId, content: [{ text: result as string }] } }],
      } as unknown as Message);
    }
  }
  return null;
}

export async function runAgentTurn(sessionId: string, userMessage: string): Promise<string> {
  await loadSecrets();

  const savedState: AgentState = (await memory.load(sessionId)) ?? { messages: [] };
  const messages = buildMessages(savedState, userMessage);
  const finalResponse = await executeReActLoop(messages);

  if (finalResponse === null) {
    console.warn(`ReAct loop exhausted for session ${sessionId}`);
    return 'I could not complete the task within the allowed steps.';
  }

  await memory.save(sessionId, {
    messages: [
      ...savedState.messages,
      { role: 'user',      content: userMessage    },
      { role: 'assistant', content: finalResponse  },
    ],
  });

  return finalResponse;
}
