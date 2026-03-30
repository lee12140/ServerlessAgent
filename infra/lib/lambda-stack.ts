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
        GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
        GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY || '',
        GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || '',
        CODE_VERSION: '1.0.2', // Bump this to force redeploy
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

    // Agent needs Bedrock, Marketplace, and DynamoDB
    this.agent.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));
    this.agent.addToRolePolicy(new iam.PolicyStatement({
      actions: ['aws-marketplace:ViewSubscriptions', 'aws-marketplace:Subscribe', 'aws-marketplace:Unsubscribe'],
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