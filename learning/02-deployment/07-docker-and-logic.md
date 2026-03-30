# Learning Module 07: Containerizing the Logic (Docker)

Now we're crossing the bridge from **Infrastructure** to **Logic**. Since we're using Docker containers, we need to define how each one is built.

## Why the Lambda Base Image?
AWS provides special Docker base images optimized for Lambda. They include the "Lambda Runtime Interface Emulator," which allows the function to talk to AWS.

## Why a Multi-Stage Build?
Our Dockerfile uses two `FROM` stages:
1. **Builder stage:** Installs all dependencies (including dev tools like TypeScript) and compiles the code.
2. **Runtime stage:** Copies only the compiled output and production `node_modules` — leaving all dev tools behind.

This keeps the final image small and fast.

## The Dockerfile (per service)
Each service has its own Dockerfile at `services/<name>/docker/Dockerfile`. Here is the pattern they all follow — using the Agent as the example:

```dockerfile
# Stage 1: Build
FROM public.ecr.aws/lambda/nodejs:22 AS builder
WORKDIR /var/task
COPY package.json tsconfig.json ./
RUN npm install
COPY src/ ./src/
RUN npx tsc

# Stage 2: Runtime
FROM public.ecr.aws/lambda/nodejs:22
WORKDIR /var/task
COPY --from=builder /var/task/dist ./dist
COPY --from=builder /var/task/node_modules ./node_modules
COPY package.json ./
CMD ["dist/index.handler"]
```

## The Lambda Entry Point
Each service has a simple `src/index.ts` that acts as the Lambda handler. Here is the Agent's:

```typescript
import { runAgentTurn } from './agent.js';

export const handler = async (event: any) => {
  const { sessionId, message } = event;

  if (!message) {
    throw new Error('No message provided to Agent');
  }

  const reply = await runAgentTurn(sessionId || 'default', message);

  return { message: reply, sessionId };
};
```

### What's happening here?
1. **`FROM ... AS builder`**: Names the first stage `builder` so we can copy from it later.
2. **`RUN npx tsc`**: Compiles TypeScript into the `dist/` folder.
3. **`COPY --from=builder`**: Pulls only the compiled output into the lean runtime image.
4. **`CMD ["dist/index.handler"]`**: Tells Lambda which file and exported function to call. `dist/index.handler` means `dist/index.js` → `export const handler`.

> [!NOTE]
> Notice that unlike the simple single-file approach, the Agent's handler does **not** talk to Bedrock or DynamoDB directly — it delegates to `agent.ts`. This separation keeps the handler clean and the logic testable.
