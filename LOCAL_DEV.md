# Local Development Guide

How to run and test the ServerlessAgent locally without deploying to AWS.

> **Requirement:** You must have already run `npx cdk deploy --all` at least once.
> The local test script hits the **real** DynamoDB tables and Bedrock — it does not mock anything.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 22+ |
| AWS CLI | configured (`aws configure`) with access to `eu-central-1` |
| AWS credentials | must have access to DynamoDB, Bedrock, and Secrets Manager |

---

## 1. Run setup

```bash
npm run setup
```

This single command:
1. Installs root dependencies (`npm install`)
2. Installs agent service dependencies (`services/agent/npm install`)
3. Creates `.env` from `.env.example` if it doesn't exist yet

---

## 2. Create your `.env` file

> Skip this if `npm run setup` already created `.env` for you — just open it and fill in the values.

```bash
cp .env.example .env
```

Then fill in the required values:

```env
# Mandatory — copy table names from CDK deploy output
TABLE_NAME=AgentDbStack-SessionTableXXXXXXXX-XXXXXXXXXXXX
NOTES_TABLE_NAME=AgentDbStack-NotesTableXXXXXXXX-XXXXXXXXXXXX
EXPENSES_TABLE_NAME=AgentDbStack-ExpensesTableXXXXXXXX-XXXXXXXXXXXX

REGION=eu-central-1
API_KEY=OC-your-api-key-here
```

> **Finding your table names:** After `cdk deploy --all`, the CDK output prints all resource names.
> You can also look them up in the AWS Console under DynamoDB → Tables.

### Credentials for skills (optional)

Locally, the agent skips Secrets Manager when `SECRET_NAME` is not set — it falls back to env vars.
Add these to `.env` if you want to test skills that need them:

```env
# Google Calendar / Gmail
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=your@gmail.com
GMAIL_SENDER_EMAIL=your@gmail.com

# Weather
WEATHER_API_KEY=your-openweathermap-key
```

Skills that lack credentials degrade gracefully — they return an error message instead of crashing.

---

## 3. Run the agent locally

```bash
cd services/agent
npm run test:local "Your message here"
```

**Examples:**

```bash
# Default test (time + calendar)
npm run test:local

# Ask something simple
npm run test:local "What time is it?"

# Test web search
npm run test:local "Search for the latest news about AI"

# Test calculations
npm run test:local "What is 15% tip on a $87.50 dinner?"

# Test weather
npm run test:local "What's the weather like in Berlin?"

# Test notes
npm run test:local "Save a note: pick up groceries on Friday"

# Test expense tracking
npm run test:local "Log an expense: coffee, 4.50 EUR, food"

# Multi-turn — re-use the same session by hardcoding sessionId in test-local.ts
npm run test:local "What did I just save as a note?"
```

The script creates a new session ID each run (`test-session-<timestamp>`).

---

## 4. What happens when you run it

```
test-local.ts
  └── loads .env
  └── calls runAgentTurn(sessionId, message)
        └── loadSecrets()           — skips Secrets Manager if SECRET_NAME not set
        └── memory.load(sessionId)  — reads conversation history from DynamoDB
        └── executeReActLoop()      — sends to Bedrock, executes tools as needed
        └── memory.save(sessionId)  — writes updated conversation to DynamoDB
  └── prints the agent's response
```

Tool calls are logged in real time as they happen:
```
Tool call: get_current_time
Tool call: create_calendar_meeting
```

---

## 5. Type-check the code

```bash
# From the project root
npx tsc --noEmit
```

This checks all TypeScript across `infra/` and `services/` without emitting any files.

---

## 6. Test the deployed API

Once deployed, test the live API with curl:

```bash
# Text message
curl -X POST https://YOUR_API_URL/webhook \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"message": "What time is it?", "sessionId": "my-test"}'

# Check CDK output for YOUR_API_URL, or find it in API Gateway → Stages in the AWS Console
```

---

## 7. Common issues

| Problem | Fix |
|---|---|
| `TABLE_NAME is not set` | Add it to `.env` from CDK deploy output |
| `CredentialsProviderError` | Run `aws configure` or check your IAM role has DynamoDB + Bedrock access |
| `Could not load credentials from any providers` | Your AWS CLI session may have expired — re-authenticate |
| `ResourceNotFoundException` on DynamoDB | Table name in `.env` doesn't match — check CDK output |
| Bedrock `AccessDeniedException` | Your AWS user needs `bedrock:InvokeModel` permission in `eu-central-1` |
| Google Calendar skill fails | Add `GOOGLE_*` vars to `.env` — the skill will still return a clean error without them |
| `Cannot find module` errors | Run `npm install` inside `services/agent/` |
