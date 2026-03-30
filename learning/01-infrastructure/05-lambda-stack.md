# Learning Module 05: The Brain (Lambda & Containers)

This is where the magic happens! We're creating a **Lambda function** that will run our AI logic. 

## Why a Container?
Instead of just uploading a `.js` file, we're using a **Docker Container**.
1. **SnapStart:** Allows the AI to "wake up" in less than 200ms.
2. **Control:** We can install exactly the tools and libraries our AI needs.
3. **Consistency:** It runs exactly the same on your machine as it does on AWS.

## The Code
Create a new file named `infra/lib/lambda-stack.ts` and paste the following:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';

export class LambdaStack extends cdk.Stack {
  public readonly handler: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define the Lambda function using a Docker Image
    this.handler = new lambda.DockerImageFunction(this, 'AgentHandler', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(process.cwd(), 'docker')),
      memorySize: 1024, // 1GB of RAM for AI processing
      timeout: cdk.Duration.seconds(30), // Allow 30 seconds for the AI to "think"
      architecture: lambda.Architecture.X86_64,
    });

    // Enable SnapStart for instant-on performance
    // (Note: This requires a specialized configuration we'll add later)
  }
}
```

### What's happening here?
1. **`DockerImageFunction`**: Tells AWS to build a Docker image from our `docker/` folder.
2. **`memorySize: 1024`**: AI models can be memory-heavy. 1024MB is a good starting point.
3. **`timeout: 30`**: Normal web requests are fast, but AI can take a few seconds to generate a response.
4. **`path.join(...)`**: Tells CDK where to find your `Dockerfile`.

> [!IMPORTANT]
> Since we're using ES Modules now, we use `process.cwd()` to find the right path.
