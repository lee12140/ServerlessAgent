import { DynamoMemoryAdapter, type AgentState } from './adapters/dynamo-memory.js';
import { loadSecrets } from './adapters/secrets.js';
import { converse, DEFAULT_MODEL_ID } from './adapters/bedrock.js';
import type { Message } from './adapters/bedrock.js';
import { getTimeDefinition, getTime } from './skills/get-time.js';
import { createMeetingDefinition, createMeeting } from './skills/calendar.js';
import { readCalendarDefinition, readCalendarEvents } from './skills/read-calendar.js';
import { researchDefinition, webSearch } from './skills/research.js';
import { getNewsDefinition, getNews } from './skills/get-news.js';
import { getWeatherDefinition, getWeather } from './skills/get-weather.js';
import { sendEmailDefinition, sendEmail } from './skills/send-email.js';
import { calculateDefinition, calculate } from './skills/calculate.js';
import { currencyExchangeDefinition, currencyExchange } from './skills/currency-exchange.js';
import { summarizeUrlDefinition, fetchUrlContent } from './skills/summarize-url.js';
import { setNoteDefinition, setNote, getNoteDefinition, getNote } from './skills/notes.js';
import { logExpenseDefinition, logExpense, getExpensesDefinition, getExpenses } from './skills/track-expense.js';

const MODEL_ID = process.env.MODEL_ID || DEFAULT_MODEL_ID;
const MAX_ITERATIONS = 8;

const memory = new DynamoMemoryAdapter(process.env.TABLE_NAME!);

const SYSTEM_PROMPT = `You are a professional Executive Personal Assistant. Your goal is to manage the user's schedule, information, and daily tasks with extreme professionalism and proactivity.

CORE DIRECTIVES:
1. TOOL USE: You MUST use tools to fulfill requests. Never explain how to do something manually if a tool exists.
2. DATE VERIFICATION: Before scheduling ANY meeting, you MUST call 'get_current_time' to ensure you have the correct date and year.
3. PROACTIVITY: If a user specifies a start time but no duration, assume 1 hour. Default to 'Europe/Berlin' timezone unless otherwise specified.
4. TONE: Be professional, concise, and helpful. Act like a high-level executive assistant.
5. NO HALLUCINATION: Always use the exact data returned by tools in your confirmations.
6. CALCULATIONS: Always use the 'calculate' tool for any arithmetic — never compute numbers yourself.
7. NOTES: Use 'set_note' / 'get_note' to persist information the user wants to remember across conversations.
8. EXPENSES: Use 'log_expense' / 'get_expenses' to track spending when the user mentions purchases.`;

const TOOLS = [
  getTimeDefinition,
  createMeetingDefinition,
  readCalendarDefinition,
  researchDefinition,
  getNewsDefinition,
  getWeatherDefinition,
  sendEmailDefinition,
  calculateDefinition,
  currencyExchangeDefinition,
  summarizeUrlDefinition,
  setNoteDefinition,
  getNoteDefinition,
  logExpenseDefinition,
  getExpensesDefinition,
];

const TOOL_IMPLEMENTATIONS: Record<string, (input: unknown) => string | Promise<string>> = {
  get_current_time: () => getTime(),
  create_calendar_meeting: (input) => createMeeting(input as Parameters<typeof createMeeting>[0]),
  read_calendar_events: (input) => readCalendarEvents(input as Parameters<typeof readCalendarEvents>[0]),
  web_search: (input) => webSearch(input as Parameters<typeof webSearch>[0]),
  get_news: (input) => getNews(input as Parameters<typeof getNews>[0]),
  get_weather: (input) => getWeather(input as Parameters<typeof getWeather>[0]),
  send_email: (input) => sendEmail(input as Parameters<typeof sendEmail>[0]),
  calculate: (input) => calculate(input as Parameters<typeof calculate>[0]),
  currency_exchange: (input) => currencyExchange(input as Parameters<typeof currencyExchange>[0]),
  fetch_url_content: (input) => fetchUrlContent(input as Parameters<typeof fetchUrlContent>[0]),
  set_note: (input) => setNote(input as Parameters<typeof setNote>[0]),
  get_note: (input) => getNote(input as Parameters<typeof getNote>[0]),
  log_expense: (input) => logExpense(input as Parameters<typeof logExpense>[0]),
  get_expenses: (input) => getExpenses(input as Parameters<typeof getExpenses>[0]),
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
  await loadSecrets();
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
