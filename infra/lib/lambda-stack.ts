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
      timeout: cdk.Duration.seconds(60),
      environment: {
        TABLE_NAME: props.tableName,
        REGION: 'eu-central-1',
        MODEL_ID: 'eu.amazon.nova-pro-v1:0',
        CODE_VERSION: '1.0.7', // Bump this to force redeploy
        // Required — Google Calendar & email skills
        ...process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && { GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL },
        ...process.env.GOOGLE_PRIVATE_KEY          && { GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY },
        ...process.env.GOOGLE_CALENDAR_ID          && { GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID },
        // Optional — email sending (requires Workspace domain-wide delegation)
        ...process.env.GMAIL_SENDER_EMAIL          && { GMAIL_SENDER_EMAIL: process.env.GMAIL_SENDER_EMAIL },
        // Optional — weather skill
        ...process.env.WEATHER_API_KEY             && { WEATHER_API_KEY: process.env.WEATHER_API_KEY },
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

    // Middleware needs to call Agent and Transcriber
    this.agent.grantInvoke(this.middleware);
    this.transcriber.grantInvoke(this.middleware);

    // Agent needs Bedrock and DynamoDB (scoped to the agent's own table)
    this.agent.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));
    this.agent.addToRolePolicy(new iam.PolicyStatement({
      // Read-only Marketplace access — removed Subscribe/Unsubscribe to prevent accidental charges
      actions: ['aws-marketplace:ViewSubscriptions'],
      resources: ['*'],
    }));
    this.agent.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:Scan', // Required for notes listing and expense queries
      ],
      resources: [
        `arn:aws:dynamodb:eu-central-1:${this.account}:table/${props.tableName}`,
      ],
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