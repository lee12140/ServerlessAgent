# Learning Module 06: Tying it All Together (The Main Entry Point)

You've built the database, the API, and the Lambda. Now we need to tell CDK how they all fit together. This is the "Orchestrator".

## What does the Main Entry Point do?
1. **Initializes the CDK App:** The top-level container.
2. **Creates the Stacks:** Instantiates your `DbStack`, `LambdaStack`, and `ApiStack`.
3. **Passes Data:** It tells the `ApiStack` which `Lambda` to use.

## The Code
Create a new file named `infra/bin/main.ts` and paste the following:

```typescript
import * as cdk from 'aws-cdk-lib';
import { DbStack } from '../lib/db-stack.js';
import { LambdaStack } from '../lib/lambda-stack.js';
import { ApiStack } from '../lib/api-stack.js';

const app = new cdk.App();

// 1. Create the Database
const dbStack = new DbStack(app, 'AgentDbStack');

// 2. Create the Lambda (Brain)
const lambdaStack = new LambdaStack(app, 'AgentLambdaStack');

// 3. Create the API and connect it to the Lambda
new ApiStack(app, 'AgentApiStack', {
  handler: lambdaStack.handler,
});

// Synthesize the app
app.synth();
```

### What's happening here?
1. **`import ... from '../lib/db-stack.js'`**: Notice the `.js` extension! Because we are using **ES Modules**, we have to point to the *compiled* file extension, even though we're writing in TypeScript.
2. **`handler: lambdaStack.handler`**: Here is the connection! We take the `handler` we created in the `LambdaStack` and hand it over to the `ApiStack`.
3. **`app.synth()`**: This is the magic command that turns all your TypeScript code into a giant AWS CloudFormation template that AWS understands.

## Why the `.js` in imports?
Since we set `"type": "module"` in `package.json`, Node.js requires explicit file extensions in imports. TypeScript follows this rule. Even though your file is `.ts`, you must import it as `.js`.

### Next Step
After this, we'll create the **Dockerfile** so AWS knows how to build your AI agent's "box"!
