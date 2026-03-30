# Module 14: The Stateless Adapter — Wiring Everything Together ⚡

## What You'll Build
You will update `src/handlers/index.ts` to go through the new agent layer.
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

- `src/agent.ts` — The stateless agent entry point
- `src/adapters/bedrock.ts` — Wraps Bedrock calls
- `src/adapters/dynamo-memory.ts` — Reads/writes session state to DynamoDB

Open each one and read through the comments to understand the flow before continuing.

---

## ✏️ Step 1: Update the Handler

Open `src/handlers/index.ts` and replace the entire file with the code below.

**Before you paste** — read through this explanation of what each part does:

| Line | What it does |
|---|---|
| `import type { ... }` | Imports the TypeScript types for the AWS Lambda event. `type` means it's only used for type-checking, not at runtime. |
| `import { runAgentTurn }` | Imports our new agent function. This is the key change — we no longer call Bedrock directly. |
| `const body = ...` | Safely parses the JSON body from the HTTP request. If no body was sent, it defaults to `{}`. |
| `const userMessage` | Extracts the `message` field from the request body. Falls back to `'Hello!'` if not provided. |
| `const sessionId` | Extracts the `sessionId` field — this is the "memory key" in DynamoDB. Different sessions = separate conversations. |
| `runAgentTurn(sessionId, userMessage)` | ✨ The magic line. Passes control to `agent.ts`, which handles memory, Bedrock, and tools. |
| `statusCode: 200` | Tells the caller "everything worked". |
| `body: JSON.stringify(...)` | Returns the AI reply and the sessionId as a JSON string. |

```typescript
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { runAgentTurn } from '../agent.js';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Parse the incoming HTTP request body
    const body = event.body ? JSON.parse(event.body) : {};

    // Get the user's message (what they typed)
    const userMessage: string = body.message || 'Hello!';

    // Get the session ID (which conversation is this part of?)
    const sessionId: string = body.sessionId || 'default';

    // Hand off to the agent — it handles memory, AI calls, and tools
    const reply = await runAgentTurn(sessionId, userMessage);

    // Return the AI's reply as a JSON HTTP response
    return {
        statusCode: 200,
        body: JSON.stringify({ message: reply, sessionId }),
    };
};
```

> **Why is this better than before?** The old handler had 50 lines of Bedrock code, DynamoDB code, and error handling all mixed together. Now it's 6 lines that tell a clear story: *"get input → run agent → return output."* All the complexity moved to `agent.ts` where it belongs.

---

## 🚀 Step 2: Deploy

```powershell
$env:Path += ";C:\Program Files\Amazon\AWSCLIV2"; $env:Path += ";C:\Program Files\Docker\Docker\resources\bin"
npx cdk deploy AgentLambdaStack
```

---

## 🧪 Step 3: Test the Wired Agent

```powershell
# Start a conversation
Invoke-RestMethod -Uri "https://2q2i0svz82.execute-api.eu-central-1.amazonaws.com/webhook" -Method Post -Body '{"message": "My name is Leo and I am building an AI agent", "sessionId": "wire-test-1"}' -ContentType "application/json"

# Test that it remembers
Invoke-RestMethod -Uri "https://2q2i0svz82.execute-api.eu-central-1.amazonaws.com/webhook" -Method Post -Body '{"message": "What am I building?", "sessionId": "wire-test-1"}' -ContentType "application/json"
```

✅ **Success:** The AI replies and remembers what you told it.

---

## ✅ Module Complete!

Once this works, you have a clean, production-grade architecture:
- The **handler** is simple.
- The **agent** is powerful.
- The **adapters** are swappable (want to use Claude later? Change one line in `bedrock.ts`).

➡️ **Next: [Module 15 — Skills](./15-skills.md)**
