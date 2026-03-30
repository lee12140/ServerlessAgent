# Learning Module 02: The Anatomy of a Serverless Project

Now that we have our tools installed, let's organize our workspace. A clean project structure makes it much easier to maintain and scale your AI agent.

## Why this structure?
We are splitting our project into three main areas:

### 1. The Infrastructure (`/infra`)
This is where the "Blueprint" of your cloud environment lives.
- `infra/bin`: The entry point for the CDK. This is the script that "starts" the deployment.
- `infra/lib`: Where the actual resource definitions (Stacks) live. For example, your database stack and your API stack.

### 2. The Services (`/services`)
Instead of one big Lambda, we split the work across three specialist microservices. Each service is self-contained with its own source code, dependencies, and Dockerfile.

- `services/agent/` — The AI Brain. Handles reasoning, tool use, and DynamoDB memory.
  - `src/index.ts`: Lambda handler entry point
  - `src/agent.ts`: The ReAct loop (think → act → observe)
  - `src/adapters/`: Bedrock and DynamoDB clients
  - `src/skills/`: Tools the AI can call (e.g., web search, calendar)
  - `docker/Dockerfile`: Container definition for this service

- `services/middleware/` — The Orchestrator. Receives HTTP requests, validates the API key, and routes to the right specialist.
  - `src/index.ts`: Lambda handler entry point
  - `docker/Dockerfile`: Container definition

- `services/transcriber/` — The Ears. Converts voice audio to text using Amazon Transcribe.
  - `src/index.ts`: Lambda handler entry point
  - `docker/Dockerfile`: Container definition

### 3. The Infrastructure (`/infra`)
Each service gets its own Docker image but they are all defined and deployed together from the CDK stacks in `/infra`.

## Commands to create the structure
For Windows PowerShell:
```powershell
New-Item -ItemType Directory -Path infra/bin, infra/lib
New-Item -ItemType Directory -Path services/agent/src/adapters, services/agent/src/skills, services/agent/docker
New-Item -ItemType Directory -Path services/middleware/src, services/middleware/docker
New-Item -ItemType Directory -Path services/transcriber/src, services/transcriber/docker
```
