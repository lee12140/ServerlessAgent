# Module 15: Skills — Giving the Agent "Hands" 🛠️

## What is a Skill?
Right now the agent can only **think** (call an LLM). A **Skill** lets it **act** — like searching the web, reading a file, sending an email, or calling an API.

> [!NOTE]
> **You are building your own agent from scratch.** There is no external package to install. The files in `src/agent.ts`, `src/adapters/`, and `src/skills/` are 100% your own code following the ReAct agent architecture pattern. This is better — you have full control!

The agent uses a **Tool Use** pattern (also called "function calling"). The flow is:

1. 🧠 **Think:** LLM decides it needs information → picks a tool
2. ⚡ **Act:** Lambda calls the tool function
3. 👁️ **Observe:** Result is fed back to the LLM
4. 🔁 **Repeat** until the task is done

---

## 🗂️ File Structure
Each skill is a single TypeScript file in `src/skills/` — which you've already started!

```
src/skills/
├── get-time.ts     ← ✅ Already created by you!
└── (more to come)
```

---

## ✏️ Step 1: Review Your First Skill (`get-time.ts`)

You've already created `src/skills/get-time.ts` — great! Here's a breakdown of what each part means:

```typescript
/**
 * Skill: Get Current Time
 * A simple example skill — returns the current date and time.
 */

// This is the "declaration" — what you tell the LLM about this tool
export const getTimeDefinition = {
    name: 'get_current_time',
    description: 'Returns the current date and time. Use this when the user asks what time it is.',
    inputSchema: {
        json: {
            type: 'object',
            properties: {},  // No inputs needed
            required: [],
        },
    },
};

// This is the actual implementation
export function getTime(): string {
    const now = new Date();
    return `The current time is ${now.toLocaleTimeString()} on ${now.toLocaleDateString('en-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
}
```

---

## ✏️ Step 2: Register the Skill in `src/agent.ts`

Update `src/agent.ts` to tell the LLM about your skills and handle tool calls:

```typescript
import { DynamoMemoryAdapter, type AgentState } from './adapters/dynamo-memory.js';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { getTimeDefinition, getTime } from './skills/get-time.js';

const bedrock = new BedrockRuntimeClient({ region: process.env.REGION || 'eu-central-1' });

// Register all available tools here
const TOOLS = [getTimeDefinition];

// Map tool names to their implementations
const TOOL_IMPLEMENTATIONS: Record<string, (input: unknown) => string> = {
    get_current_time: () => getTime(),
};

export async function runAgentTurn(sessionId: string, userMessage: string): Promise<string> {
    const memory = new DynamoMemoryAdapter(process.env.TABLE_NAME!);
    const savedState: AgentState = (await memory.load(sessionId)) ?? { messages: [] };

    const messages = [
        ...savedState.messages.map(m => ({
            role: m.role,
            content: [{ text: m.content }],
        })),
        { role: 'user' as const, content: [{ text: userMessage }] },
    ];

    // ReAct Loop: think → act → observe (repeat up to 5 times)
    let finalResponse = 'I could not complete the task.';
    for (let i = 0; i < 5; i++) {
        const response = await bedrock.send(new ConverseCommand({
            modelId: 'eu.amazon.nova-lite-v1:0',
            messages,
            toolConfig: { tools: TOOLS.map(t => ({ toolSpec: t })) },
            inferenceConfig: { maxTokens: 2000, temperature: 0.7 },
        }));

        const stopReason = response.stopReason;

        if (stopReason === 'end_turn') {
            // The AI is done — extract the final text response
            finalResponse = response.output?.message?.content?.[0]?.text ?? finalResponse;
            messages.push({ role: 'assistant', content: [{ text: finalResponse }] });
            break;
        }

        if (stopReason === 'tool_use') {
            // The AI wants to use a tool
            const toolUseBlock = response.output?.message?.content?.find(b => 'toolUse' in b);
            if (!toolUseBlock || !('toolUse' in toolUseBlock)) break;

            const { toolUseId, name, input } = toolUseBlock.toolUse!;
            console.log(`Agent calling tool: ${name}`);

            // Add the AI's "I want to call this tool" message
            messages.push({ role: 'assistant', content: response.output!.message!.content! } as any);

            // Execute the tool and add the result
            const toolResult = TOOL_IMPLEMENTATIONS[name!]?.(input) ?? 'Tool not found.';
            messages.push({
                role: 'user',
                content: [{
                    toolResult: {
                        toolUseId,
                        content: [{ text: toolResult }],
                    },
                }],
            } as any);
        }
    }

    // Save updated conversation state
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
```

---

## 🚀 Step 3: Deploy

```powershell
npx cdk deploy AgentLambdaStack
```

---

## 🧪 Step 4: Test the Skill!

```powershell
Invoke-RestMethod -Uri "https://2q2i0svz82.execute-api.eu-central-1.amazonaws.com/webhook" -Method Post -Body '{"message": "What time is it right now?", "sessionId": "skills-test-1"}' -ContentType "application/json"
```

✅ **Success:** The AI uses the `get_current_time` tool and replies with the actual current time — not a hallucination!

---

## 💡 Ideas for More Skills

| Skill File | What it does |
|---|---|
| `web-search.ts` | Search via DuckDuckGo API |
| `calculator.ts` | Safe math evaluation |
| `get-weather.ts` | Call OpenWeatherMap API |
| `send-email.ts` | Send via AWS SES |
| `dynamo-read.ts` | Read custom data from DynamoDB |

➡️ **Next: [Module 16 — Telegram/Discord Webhook](./16-webhooks.md)**
