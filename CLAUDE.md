# ServerlessAgent — Claude Code Context

## What This Is
Event-driven AI personal assistant running on AWS Lambda. Uses a ReAct (reason → act → observe) loop powered by Amazon Bedrock (Nova Lite EU model). Deployed via AWS CDK.

## Architecture

```
infra/
  bin/main.ts              # CDK app entry — wires stacks together
  lib/api-stack.ts         # API Gateway (POST /webhook)
  lib/db-stack.ts          # DynamoDB (session memory)
  lib/lambda-stack.ts      # Three Docker Lambda functions

services/
  agent/src/
    agent.ts               # ReAct loop core — Bedrock ConverseCommand, MAX_ITERATIONS=5
    adapters/bedrock.ts    # Bedrock client wrapper
    adapters/dynamo-memory.ts  # Load/save AgentState to DynamoDB
    skills/calendar.ts     # Google Calendar (Service Account auth)
    skills/get-time.ts     # Returns current time (always called before scheduling)
    skills/research.ts     # DuckDuckGo web search
  middleware/src/index.ts  # Routes text/voice to agent or transcriber; validates API_KEY
  transcriber/src/index.ts # Base64 audio → AWS Transcribe → text
```

## Key Runtime Config (env vars)
| Variable | Used By | Notes |
|---|---|---|
| `TABLE_NAME` | agent | DynamoDB table from CDK deploy output |
| `REGION` | agent, transcriber | `eu-central-1` |
| `MODEL_ID` | agent | Defaults to `eu.amazon.nova-lite-v1:0` |
| `API_KEY` | middleware | Validates incoming webhook requests (`OC-` prefix) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | agent/calendar | From GCP service account JSON |
| `GOOGLE_PRIVATE_KEY` | agent/calendar | PEM key from GCP service account JSON |
| `GOOGLE_CALENDAR_ID` | agent/calendar | Usually your Gmail address |
| `AUDIO_BUCKET` | transcriber | S3 bucket name from CDK output |
| `CODE_VERSION` | agent | Bump in `lambda-stack.ts` to force Lambda redeploy |

## Common Commands
```bash
# Type-check all TypeScript (no emit)
npx tsc --noEmit

# Deploy everything to AWS
npx cdk deploy --all

# Preview infra changes before deploying
npx cdk diff

# Run agent locally against real DynamoDB (requires .env with TABLE_NAME)
npx tsx services/agent/src/test-local.ts
```

## Critical Constraints
- **Docker images only** — Lambda uses `DockerImageFunction`, not zip. Dockerfile changes require `cdk deploy`.
- **ESM project** — `"type": "module"` in package.json. All imports must use `.js` extensions.
- **Bedrock region** — Model is `eu.amazon.nova-lite-v1:0` in `eu-central-1`. Using other regions will fail.
- **ReAct loop cap** — `MAX_ITERATIONS = 5` in `agent.ts`. Increase carefully; each iteration = a Bedrock call.
- **`<thinking>` stripping** — Nova Lite exposes reasoning in `<thinking>` tags. `stripThinking()` removes them before returning to the user. Do not remove this.
- **No hardcoded credentials** — AWS auth uses IAM roles. Google credentials via env vars only.

## IAM Permissions (from lambda-stack.ts)
- **Agent**: `bedrock:InvokeModel`, `dynamodb:GetItem/PutItem/UpdateItem`
- **Transcriber**: `s3:PutObject/GetObject`, `transcribe:StartTranscriptionJob/GetTranscriptionJob`
- **Middleware**: can invoke Agent and Transcriber Lambdas

## Local Dev Notes
- Copy `.env.example` → `.env` and fill in real values before running locally.
- `test-local.ts` uses `dotenv` to load `.env` — never commit `.env`.
- TypeScript config: strict mode, `nodenext` modules, `noUncheckedIndexedAccess`.
