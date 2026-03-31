# ServerlessAgent

**Event-driven AI personal assistant running on AWS Lambda.**

Processes text and voice messages via webhook, reasons with Amazon Bedrock (Nova Pro EU) using a ReAct loop, executes 14 built-in skills, and maintains conversation memory in DynamoDB — fully serverless, pay-per-use, ~$5–15/month for personal use.

---

## Architecture

```
Client (text or voice)
        │
        ▼
API Gateway
  POST /webhook          ← send a message or audio
  GET  /status/{jobId}   ← poll for voice transcription result
        │
        ▼
Middleware Lambda (orchestrator)
  ├── text  → Agent Lambda (sync)  → response
  └── voice → Transcriber Lambda (async, fires and returns jobId immediately)
                    │
                    ▼ (runs in background, up to 2 min)
              AWS Transcribe + S3
                    │
                    ▼
              DynamoDB (stores transcript)
                    │
              Client polls GET /status/{jobId}
                    │
                    ▼
              Agent Lambda → Bedrock → response

Agent Lambda (ReAct loop, up to 8 iterations)
  ├── Amazon Bedrock — Nova Pro EU
  ├── DynamoDB — conversation memory
  └── Skills (14 built-in, see below)
```

### ReAct Loop

Each agent turn runs a think → act → observe loop:

1. Send conversation history + available tools to Bedrock
2. If Bedrock calls a tool (`tool_use`), execute it and feed the result back
3. Repeat until Bedrock signals `end_turn` or 8 iterations are reached
4. Strip internal `<thinking>` blocks and return the final response

---

## Skills

| Skill | Tool Name | Description |
|---|---|---|
| Get Time | `get_current_time` | Current date and time (Europe/Berlin) |
| Create Meeting | `create_calendar_meeting` | Schedule a Google Calendar event |
| Read Calendar | `read_calendar_events` | List upcoming events |
| Web Search | `web_search` | DuckDuckGo real-time search |
| Get News | `get_news` | Latest headlines by topic |
| Get Weather | `get_weather` | Current weather + forecast via OpenWeatherMap |
| Send Email | `send_email` | Send email via Gmail API |
| Calculate | `calculate` | Safe math expression evaluator |
| Currency Exchange | `currency_exchange` | Real-time rates via frankfurter.app |
| Fetch URL | `fetch_url_content` | Read and summarize a webpage |
| Save Note | `set_note` | Persist a note in DynamoDB |
| Get Note | `get_note` | Retrieve a saved note |
| Log Expense | `log_expense` | Record a personal expense |
| Get Expenses | `get_expenses` | Spending summary by category |

---

## Project Structure

```
serverless-agent/
├── ARCHITECTURE.md           # Memory model, improvement roadmap, implementation guides
│
├── infra/                    # AWS CDK (Infrastructure-as-Code)
│   ├── bin/main.ts           # CDK app entry — wires stacks together
│   └── lib/
│       ├── db-stack.ts       # DynamoDB tables (session, notes, expenses) + S3 audio bucket
│       ├── lambda-stack.ts   # 3 Docker Lambda functions + scoped IAM
│       └── api-stack.ts      # HTTP API Gateway (POST /webhook, GET /status/{jobId})
│
├── services/
│   ├── agent/                # The Brain — ReAct loop, Bedrock, skills, memory
│   │   └── src/
│   │       ├── agent.ts              # ReAct loop core
│   │       ├── index.ts              # Lambda handler entry point
│   │       ├── adapters/
│   │       │   ├── bedrock.ts        # Bedrock ConverseCommand wrapper
│   │       │   ├── dynamo-memory.ts  # Load/save conversation state (trimmed to 20 turns)
│   │       │   └── secrets.ts        # Loads credentials from AWS Secrets Manager at cold start
│   │       └── skills/
│   │           ├── types.ts          # Skill interface { definition, execute }
│   │           ├── index.ts          # Skill registry — the only file to edit when adding a skill
│   │           ├── get-time.ts
│   │           ├── calendar.ts
│   │           ├── read-calendar.ts
│   │           ├── research.ts
│   │           ├── get-news.ts
│   │           ├── get-weather.ts
│   │           ├── send-email.ts
│   │           ├── calculate.ts
│   │           ├── currency-exchange.ts
│   │           ├── summarize-url.ts
│   │           ├── notes.ts
│   │           └── track-expense.ts
│   │
│   ├── middleware/           # Orchestrator — routes text/voice, validates API key
│   │   └── src/index.ts
│   │
│   └── transcriber/          # Async audio transcription — Base64 audio → text
│       └── src/index.ts
│
├── .env.example              # Environment variable template for local dev
└── cdk.json
```

---

## Tech Stack

| Layer | Service |
|---|---|
| Compute | AWS Lambda (Docker images, Node.js 22) |
| AI Model | Amazon Bedrock — Nova Pro EU (`eu.amazon.nova-pro-v1:0`) |
| Conversation State | Amazon DynamoDB (pay-per-request, 20-turn trim) |
| Notes & Expenses | Amazon DynamoDB (dedicated tables) |
| Audio Transcription | AWS Transcribe + S3 (async, auto-language detection) |
| Secrets | AWS Secrets Manager |
| API | API Gateway HTTP API v2 |
| IaC | AWS CDK v2 (TypeScript) |

---

## Cost Estimate (500 requests/month)

| Service | Cost |
|---|---|
| Lambda compute | ~$0.00 (Free Tier) |
| DynamoDB | ~$0.00 (Always Free tier) |
| Secrets Manager | ~$0.40/month per secret |
| Bedrock (Nova Pro) | ~$8–15 (token-dependent) |
| **Total** | **~$10–15/month** |

---

## Getting Started

### Prerequisites

- AWS CLI configured (`aws configure`)
- Docker running
- Node.js 22+

### 1. Install dependencies

```bash
npm install
```

### 2. Create your credentials secret in AWS Secrets Manager

Sensitive credentials are stored in Secrets Manager, not in code or env files.
Create the secret once:

```bash
aws secretsmanager create-secret \
  --name ServerlessAgent/credentials \
  --region eu-central-1 \
  --secret-string '{
    "GOOGLE_SERVICE_ACCOUNT_EMAIL": "your-sa@project.iam.gserviceaccount.com",
    "GOOGLE_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\n...",
    "GOOGLE_CALENDAR_ID": "your@gmail.com",
    "GMAIL_SENDER_EMAIL": "your@gmail.com",
    "WEATHER_API_KEY": "your-openweathermap-key"
  }'
```

Only include keys you actually have. Skills degrade gracefully when credentials are missing.

### 3. Configure local environment

```bash
cp .env.example .env
# Set API_KEY and TABLE_NAME (from a previous CDK deploy output, for local testing)
```

### 4. Deploy to AWS

```bash
npx cdk bootstrap   # first time only
npx cdk deploy --all
```

CDK will output your API Gateway URL.

### 5. Test locally

```bash
cd services/agent
npm run test:local "What time is it?"
```

---

## API Usage

### Send a text message

```bash
curl -X POST https://YOUR_API_URL/webhook \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"message": "Schedule a meeting with Anna tomorrow at 10am", "sessionId": "my-session"}'
```

Response:
```json
{
  "message": "Meeting scheduled: ...",
  "sessionId": "my-session",
  "source": "text"
}
```

`sessionId` is optional — one is generated for you if omitted. Persist it on the client to maintain conversation context across requests.

### Send a voice message (async)

```bash
# Step 1 — submit audio
curl -X POST https://YOUR_API_URL/webhook \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"audio": "<base64-encoded-webm>", "sessionId": "my-session"}'
# → { "jobId": "abc-123", "sessionId": "my-session", "status": "processing" }

# Step 2 — poll until complete (typically 10–30s)
curl https://YOUR_API_URL/status/abc-123 \
  -H "x-api-key: YOUR_API_KEY"
# → { "status": "completed", "message": "...", "sessionId": "my-session" }
```

Poll every 3–5 seconds until `status` is `completed` or `failed`.

---

## Environment Variables

These are set automatically by CDK at deploy time. For local development, set them in `.env`.

| Variable | Set By | Description |
|---|---|---|
| `TABLE_NAME` | CDK | DynamoDB session table |
| `NOTES_TABLE_NAME` | CDK | DynamoDB notes table |
| `EXPENSES_TABLE_NAME` | CDK | DynamoDB expenses table |
| `SECRET_NAME` | CDK | Secrets Manager secret name |
| `REGION` | CDK | AWS region (`eu-central-1`) |
| `MODEL_ID` | CDK | Bedrock model ID |
| `API_KEY` | Your shell | Webhook authentication key |
| `AUDIO_BUCKET` | CDK | S3 bucket for voice uploads |
| `ALLOWED_ORIGIN` | Your shell | CORS origin (defaults to `*`) |

Sensitive credentials (`GOOGLE_*`, `WEATHER_API_KEY`, `GMAIL_SENDER_EMAIL`) live in Secrets Manager — not in environment variables.

---

## Adding a New Skill

```
1. Create services/agent/src/skills/my-skill.ts

   import type { Skill } from './types.js';

   export const mySkill: Skill = {
     definition: {
       name: 'my_tool_name',
       description: 'What this skill does and when to use it.',
       inputSchema: {
         json: {
           type: 'object',
           properties: {
             param: { type: 'string', description: '...' },
           },
           required: ['param'],
         },
       },
     },
     execute: async (input) => {
       const { param } = input as { param: string };
       return `Result: ${param}`;
     },
   };

2. Add to services/agent/src/skills/index.ts:

   import { mySkill } from './my-skill.js';

   export const skills: Skill[] = [
     ...existing skills...,
     mySkill,      // ← add here
   ];

3. Redeploy:

   npx cdk deploy AgentLambdaStack
```

No other files need to change. `agent.ts` picks up the skill automatically from the registry.

---

## Further Reading

See [ARCHITECTURE.md](./ARCHITECTURE.md) for:
- Why the current memory model causes amnesia after 20 turns
- Three-layer memory architecture (user profile / episodic summary / working memory)
- Step-by-step implementation guides for long-term memory
- How to reduce Bedrock costs ~75% with session summarization
