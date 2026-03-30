# Learning Module 07: Containerizing the Logic (Docker)

Now we're crossing the bridge from **Infrastructure** to **Logic**. Since we're using a container, we need to define how that container is built.

## Why the Lambda Base Image?
AWS provides special Docker base images that are optimized for Lambda. They include the "Lambda Runtime Interface Emulator," which allows the function to talk to AWS.

## The Dockerfile
Create a new file named `docker/Dockerfile` and paste the following:

```dockerfile
# Use the official AWS Lambda Node.js 22 image
FROM public.ecr.aws/lambda/nodejs:22

# Copy the package.json and install dependencies
COPY package.json ${LAMBDA_TASK_ROOT}
RUN npm install

# Copy the source code (we'll build it later)
COPY src/ ${LAMBDA_TASK_ROOT}/src/
COPY tsconfig.json ${LAMBDA_TASK_ROOT}

# Compile TypeScript to JavaScript
RUN npx tsc

# Set the CMD to your handler (we'll create this file next)
CMD [ "src/handlers/index.handler" ]
```

## The Lambda Entry Point
Now, even though our agent isn't "smart" yet, we need a simple file to prove that the Lambda works.

Create a new file named `src/handlers/index.ts` and paste the following:

```typescript
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Hello from Serverless OpenClaw!',
      input: event.body,
    }),
  };
};
```

### What's happening here?
1. **`FROM public.ecr.aws/lambda/nodejs:22`**: This is the official "box" provided by Amazon.
2. **`${LAMBDA_TASK_ROOT}`**: This is a special folder inside the Lambda container where AWS expects your code to be.
3. **`handler`**: This is the function that AWS will call. It takes an `event` (the API request) and returns a `result` (the API response).

> [!NOTE]
> We are using `npx tsc` inside the Dockerfile to make sure the code is compiled correctly for the cloud environment.
