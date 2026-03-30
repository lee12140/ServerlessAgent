# Module 14: The Stateless Adapter — Wiring Everything Together ⚡

## What You'll Build
You will update `services/agent/src/index.ts` to delegate to the agent layer.
Before this module, your handler talks directly to Bedrock. After, it talks to your **agent**, which handles all the complexity.

**Before (today):**
```
HTTP Request → handler → Bedrock → response
```

**After (this module):**
```
HTTP Request → handler → agent.ts → adapters → Bedrock + DynamoDB → response
```

---

## 🗂️ Files Already Created for You

You should already have these files (created in the scaffold step):

- `services/agent/src/agent.ts` — The stateless agent entry point
- `services/agent/src/adapters/bedrock.ts` — Wraps Bedrock calls
- `services/agent/src/adapters/dynamo-memory.ts` — Reads/writes session state to DynamoDB

Open each one and read through the comments to understand the flow before continuing.

---

## ✏️ Step 1: Update the Handler

Open `services/agent/src/index.ts` and replace the entire file with the code below.

**Before you paste** — read through this explanation of what each part does:

| Line | What it does |
|---|---|
| `import { runAgentTurn }` | Imports our agent function. This is the key change — we no longer call Bedrock directly. |
| `const { sessionId, message }` | Destructures the incoming Lambda event (not an HTTP event — Agent is invoked Lambda-to-Lambda by Middleware). |
| `runAgentTurn(sessionId, message)` | The magic line. Passes control to `agent.ts`, which handles memory, Bedrock, and tools. |
| `return { message, sessionId }` | Returns a plain object back to Middleware (not an HTTP response). |

```typescript
import { runAgentTurn } from './agent.js';

export const handler = async (event: any) => {
    console.log('Agent received:', JSON.stringify(event));

    const { sessionId, message } = event;

    if (!message) {
        throw new Error('No message provided to Agent');
    }

    const reply = await runAgentTurn(sessionId || 'default', message);

    return { message: reply, sessionId };
};
```

> **Why is this better than before?** The old handler had 50 lines of Bedrock code, DynamoDB code, and error handling all mixed together. Now it's 6 lines that tell a clear story: *"get input → run agent → return output."* All the complexity moved to `agent.ts` where it belongs.

---

## 🚀 Step 2: Deploy

```powershell
npx cdk deploy OpenClawLambdaStack
```

---

## 🧪 Step 3: Test the Wired Agent

```powershell
# Start a conversation
Invoke-RestMethod -Uri "YOUR_API_URL/webhook" -Method Post -Body '{"message": "My name is Leo and I am building an AI agent", "sessionId": "wire-test-1"}' -ContentType "application/json" -Headers @{"x-api-key"="YOUR_API_KEY"}

# Test that it remembers
Invoke-RestMethod -Uri "YOUR_API_URL/webhook" -Method Post -Body '{"message": "What am I building?", "sessionId": "wire-test-1"}' -ContentType "application/json" -Headers @{"x-api-key"="YOUR_API_KEY"}
```

Replace `YOUR_API_URL` with the `ApiUrl` output from `cdk deploy` and `YOUR_API_KEY` with the value of your `API_KEY` environment variable.

✅ **Success:** The AI replies and remembers what you told it.

---

## ✅ Module Complete!

Once this works, you have a clean, production-grade architecture:
- The **handler** is simple.
- The **agent** is powerful.
- The **adapters** are swappable (want to switch models? Change one line in `bedrock.ts`).

➡️ **Next: [Module 15 — Skills](./15-skills.md)**
