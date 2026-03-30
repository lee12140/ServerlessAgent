# Learning Module 05: The Brain (Lambda & Containers)

This is where the magic happens! We're creating **three Lambda functions**, each a specialist in its own job. They all run as Docker containers.

## Why Three Lambdas?
A single Lambda doing everything works, but separating concerns gives us:
1. **Right-sized resources:** The AI brain gets 1 GB RAM; the lightweight orchestrator only needs 256 MB.
2. **Independent timeouts:** Audio transcription takes up to 2 minutes; the API response only needs 30 seconds.
3. **Clear ownership:** Each function has one job and only the permissions it needs.

## The Three Services
| Function | Job | Memory | Timeout |
|---|---|---|---|
| **Middleware** | Receives HTTP requests, validates API key, routes to specialists | 256 MB | 30s |
| **Agent** | Reasoning loop — calls Bedrock, uses tools, reads/writes DynamoDB | 1024 MB | 30s |
| **Transcriber** | Converts voice audio to text via Amazon Transcribe | 512 MB | 2 min |

## The Code
Create a new file named `infra/lib/lambda-stack.ts` and paste the following:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';

interface LambdaStackProps extends cdk.StackProps {
  tableName: string;
  audioBucketName: string;
}

export class LambdaStack extends cdk.Stack {
  public readonly middleware: lambda.DockerImageFunction;
  public readonly agent: lambda.DockerImageFunction;
  public readonly transcriber: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const rootDir = path.resolve(__dirname, '../../');

    // 1. Core AI Agent (Logic & Brain)
    this.agent = new lambda.DockerImageFunction(this, 'AgentFunction', {
      code: lambda.DockerImageCode.fromImageAsset(path.resolve(rootDir, 'services/agent'), {
        file: 'docker/Dockerfile',
      }),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: props.tableName,
        REGION: 'eu-central-1',
      },
    });

    // 2. Transcription Specialist (Ears)
    this.transcriber = new lambda.DockerImageFunction(this, 'TranscriberFunction', {
      code: lambda.DockerImageCode.fromImageAsset(path.resolve(rootDir, 'services/transcriber'), {
        file: 'docker/Dockerfile',
      }),
      memorySize: 512,
      timeout: cdk.Duration.minutes(2),
      environment: {
        AUDIO_BUCKET: props.audioBucketName,
        REGION: 'eu-central-1',
      },
    });

    // 3. Global Middleware (Orchestrator)
    this.middleware = new lambda.DockerImageFunction(this, 'MiddlewareFunction', {
      code: lambda.DockerImageCode.fromImageAsset(path.resolve(rootDir, 'services/middleware'), {
        file: 'docker/Dockerfile',
      }),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        API_KEY: process.env.API_KEY || '',
        AGENT_FUNCTION_NAME: this.agent.functionName,
        TRANSCRIBE_FUNCTION_NAME: this.transcriber.functionName,
      },
    });

    // --- PERMISSIONS ---

    // Middleware needs to invoke Agent and Transcriber
    this.agent.grantInvoke(this.middleware);
    this.transcriber.grantInvoke(this.middleware);

    // Agent needs Bedrock and DynamoDB
    this.agent.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));
    this.agent.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
      resources: ['*'],
    }));

    // Transcriber needs S3 and Transcribe
    this.transcriber.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject', 's3:GetObject'],
      resources: [`arn:aws:s3:::${props.audioBucketName}/*`],
    }));
    this.transcriber.addToRolePolicy(new iam.PolicyStatement({
      actions: ['transcribe:StartTranscriptionJob', 'transcribe:GetTranscriptionJob'],
      resources: ['*'],
    }));
  }
}
```

### What's happening here?
1. **`DockerImageCode.fromImageAsset(...)`**: Points CDK to the `services/agent`, `services/middleware`, and `services/transcriber` directories. Each has its own `docker/Dockerfile`.
2. **`grantInvoke`**: Lets Middleware call Agent and Transcriber directly (Lambda-to-Lambda, no extra HTTP hop).
3. **`addToRolePolicy`**: Grants each function only the permissions it actually needs — Agent gets Bedrock/DynamoDB, Transcriber gets S3/Transcribe, Middleware gets neither.
4. **`LambdaStackProps`**: We pass `tableName` and `audioBucketName` from the `DbStack` so the functions know where to read/write.

> [!IMPORTANT]
> `process.cwd()` and `import.meta.url` are used to resolve paths correctly when running with ES Modules.
