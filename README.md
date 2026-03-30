# Serverless Agent

**Event-Driven AI Autonomous Agent on AWS Lambda**

A serverless, pay-per-use AI personal assistant that processes messages via webhook, reasons with Amazon Bedrock (Nova Lite), executes tools (calendar, web search, time), and maintains conversation memory in DynamoDB — all at ~$5-10/month for personal use.

---

## Architecture

```
Webhook (text / voice)
        │
        ▼
API Gateway  POST /webhook
        │
        ▼
Middleware Lambda  ──── (voice) ────►  Transcriber Lambda
  (orchestrator)                         (AWS Transcribe)
        │
        ▼
  Agent Lambda
  (ReAct loop)
        │
        ├──► Amazon Bedrock (Nova Lite EU)
        ├──► DynamoDB (conversation memory)
        └──► Skills: calendar · web search · time
```

### ReAct Loop
The agent reasons in a think → act → observe loop (up to 5 iterations):
1. Calls Bedrock with the conversation history and available tools
2. If Bedrock requests a tool (`tool_use`), executes it and feeds the result back
3. When Bedrock signals `end_turn`, strips internal `<thinking>` blocks and returns the response

---

## Project Structure

```
serverless-agent/
├── infra/                    # AWS CDK (Infrastructure-as-Code)
│   ├── bin/main.ts           # CDK app entry — wires 3 stacks together
│   └── lib/
│       ├── db-stack.ts       # DynamoDB session table + S3 audio bucket
│       ├── lambda-stack.ts   # 3 Docker Lambda functions + IAM permissions
│       └── api-stack.ts      # HTTP API Gateway → POST /webhook
│
├── services/
│   ├── agent/                # The Brain — ReAct loop, Bedrock, skills, memory
│   │   └── src/
│   │       ├── agent.ts      # Core ReAct loop
│   │       ├── index.ts      # Lambda handler
│   │       ├── adapters/
│   │       │   ├── bedrock.ts       # Bedrock client wrapper
│   │       │   └── dynamo-memory.ts # DynamoDB state persistence
│   │       └── skills/
│   │           ├── get-time.ts      # Current date/time
│   │           ├── calendar.ts      # Google Calendar events
│   │           └── research.ts      # DuckDuckGo web search
│   │
│   ├── middleware/           # The Orchestrator — routes text/voice to specialists
│   │   └── src/index.ts
│   │
│   └── transcriber/          # The Ears — Base64 audio → text via AWS Transcribe
│       └── src/index.ts
│
├── learning/                 # Step-by-step learning modules
├── .env.example              # Environment variable template
└── cdk.json                  # CDK configuration
```

---

## Tech Stack

| Component | Service |
|-----------|---------|
| Compute | AWS Lambda (Docker images) |
| AI Model | Amazon Bedrock — Nova Lite EU (`eu.amazon.nova-lite-v1:0`) |
| State | Amazon DynamoDB (pay-per-request) |
| Audio | AWS Transcribe + S3 (auto-language detection) |
| API | API Gateway HTTP API v2 |
| IaC | AWS CDK v2 (TypeScript) |
| Runtime | Node.js 22 |

---

## Cost (500 requests/month)

| Service | Cost |
|---------|------|
| Lambda compute | ~$0.15 (Free Tier) |
| DynamoDB | ~$0.00 (Always Free) |
| Bedrock inference | ~$4–9 (token-dependent) |
| **Total** | **~$5–10/month** |

---

## Getting Started

### 1. Prerequisites
- AWS CLI configured (`aws configure`)
- Docker running
- Node.js 22+

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# Fill in your values: API_KEY, Google Calendar credentials, ALLOWED_ORIGIN
```

### 4. Deploy to AWS
```bash
npx cdk bootstrap   # first time only
npx cdk deploy --all
```

CDK will output your API Gateway URL. Use that as your webhook endpoint.

### 5. Test locally
```bash
cd services/agent
npm install
# Set TABLE_NAME in your .env, then:
npm run test:local "Schedule a meeting tomorrow at 10am"
```

---

## Sending a Message

```bash
curl -X POST https://YOUR_API_URL/webhook \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"message": "What time is it?", "sessionId": "my-session"}'
```

For voice, include a Base64-encoded `.webm` audio blob as `"audio"` instead of `"message"`.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `API_KEY` | Shared secret for webhook authentication |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Cloud service account |
| `GOOGLE_PRIVATE_KEY` | Private key for the service account |
| `GOOGLE_CALENDAR_ID` | Target Google Calendar ID |
| `ALLOWED_ORIGIN` | CORS origin (e.g. `https://yourdomain.com`). Leave blank for `*` |
| `TABLE_NAME` | DynamoDB table name (from CDK output, for local testing) |
| `AWS_REGION` | AWS region (default: `eu-central-1`) |

---

## Adding a Skill

1. Create `services/agent/src/skills/my-skill.ts` with a `definition` (tool spec) and an implementation function.
2. Register both in [services/agent/src/agent.ts](services/agent/src/agent.ts) — add to `TOOLS` and `TOOL_IMPLEMENTATIONS`.
3. Redeploy: `npx cdk deploy AgentLambdaStack`
