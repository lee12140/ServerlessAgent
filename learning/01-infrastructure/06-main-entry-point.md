# Learning Module 06: Tying it All Together (The Main Entry Point)

You've built the database, the API, and the Lambda. Now we need to tell CDK how they all fit together. This is the "Orchestrator".

## What does the Main Entry Point do?
1. **Initializes the CDK App:** The top-level container.
2. **Creates the Stacks:** Instantiates your `DbStack`, `LambdaStack`, and `ApiStack`.
3. **Passes Data:** It tells the `ApiStack` which `Lambda` to use.

## The Code
Create a new file named `infra/bin/main.ts` and paste the following:

```typescript
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { DbStack } from '../lib/db-stack.js';
import { LambdaStack } from '../lib/lambda-stack.js';
import { ApiStack } from '../lib/api-stack.js';

const app = new cdk.App();

// 1. Create the Database (DynamoDB table + S3 audio bucket)
const dbStack = new DbStack(app, 'OpenClawDbStack');

// 2. Create the Lambdas (Agent, Middleware, Transcriber)
const lambdaStack = new LambdaStack(app, 'OpenClawLambdaStack', {
  tableName: dbStack.sessionTable.tableName,
  audioBucketName: dbStack.audioBucket.bucketName,
});
lambdaStack.addDependency(dbStack);

// 3. Create the API and connect it to the Middleware
new ApiStack(app, 'OpenClawApiStack', {
  handler: lambdaStack.middleware,
});

// Synthesize the app
app.synth();
```

### What's happening here?
1. **`import ... from '../lib/db-stack.js'`**: Notice the `.js` extension! Because we are using **ES Modules**, we have to point to the *compiled* file extension, even though we're writing in TypeScript.
2. **`tableName` and `audioBucketName`**: We pass both resource names from `DbStack` into `LambdaStack` so the Lambda functions know where to read/write.
3. **`lambdaStack.addDependency(dbStack)`**: Ensures CDK deploys the database before the Lambdas, since the Lambdas need the table name at deploy time.
4. **`handler: lambdaStack.middleware`**: The API Gateway connects to the **Middleware** function — not the Agent directly. Middleware is the gatekeeper that routes traffic.
5. **`app.synth()`**: This is the magic command that turns all your TypeScript code into a giant AWS CloudFormation template that AWS understands.

## Why the `.js` in imports?
Since we set `"type": "module"` in `package.json`, Node.js requires explicit file extensions in imports. TypeScript follows this rule. Even though your file is `.ts`, you must import it as `.js`.

### Next Step
After this, we'll create the **Dockerfile** so AWS knows how to build your AI agent's "box"!
