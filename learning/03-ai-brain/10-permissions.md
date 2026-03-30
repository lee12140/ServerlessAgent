# Module 10: Giving the Agent a Voice (Permissions) 🗣️

Now that the infrastructure is live, it's time to build the "Brain." But before your Lambda function can talk to an AI model (like Claude), it needs **permission**. In AWS, this is called **IAM (Identity and Access Management)**.

## 🛡️ What are we doing?
We need to tell AWS: *"It's okay for this specific Lambda function to call the Bedrock service."*

## 📝 The Code Change
Open your `infra/lib/lambda-stack.ts` and add the Bedrock mission to it.

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam'; // 1. Import IAM
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export class LambdaStack extends cdk.Stack {
  public readonly handler: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const rootDir = path.resolve(__dirname, '../../');

    this.handler = new lambda.DockerImageFunction(this, 'AgentHandler', {
      code: lambda.DockerImageCode.fromImageAsset(rootDir, {
        file: 'docker/Dockerfile',
      }),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      architecture: lambda.Architecture.X86_64,
    });

    // 2. Grant Permission to use Bedrock!
    this.handler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'], // In production, you'd specify exact model ARNs
    }));
  }
}
```

## 🚀 How to Apply
Since we changed the "Infrastructure" (the CDK code), we need to tell AWS about it. Run this command:

```powershell
npx cdk deploy AgentLambdaStack
```

---
*Ready for the next one? Once this finishes, we'll write the code to actually send a message to the AI!*
