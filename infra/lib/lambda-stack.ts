import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';

interface LambdaStackProps extends cdk.StackProps {
  tableName: string;
  notesTableName: string;
  expensesTableName: string;
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

    // -----------------------------------------------------------------------
    // 1. Core AI Agent
    // -----------------------------------------------------------------------
    this.agent = new lambda.DockerImageFunction(this, 'AgentFunction', {
      code: lambda.DockerImageCode.fromImageAsset(path.resolve(rootDir, 'services/agent'), {
        file: 'docker/Dockerfile',
      }),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      environment: {
        TABLE_NAME:          props.tableName,
        NOTES_TABLE_NAME:    props.notesTableName,
        EXPENSES_TABLE_NAME: props.expensesTableName,
        REGION:              'eu-central-1',
        MODEL_ID:            'eu.amazon.nova-pro-v1:0',
        SECRET_NAME:         'ServerlessAgent/credentials',
        CODE_VERSION:        '1.1.0',
      },
    });

    // -----------------------------------------------------------------------
    // 2. Transcription Specialist
    // -----------------------------------------------------------------------
    this.transcriber = new lambda.DockerImageFunction(this, 'TranscriberFunction', {
      code: lambda.DockerImageCode.fromImageAsset(path.resolve(rootDir, 'services/transcriber'), {
        file: 'docker/Dockerfile',
      }),
      memorySize: 512,
      timeout: cdk.Duration.minutes(2),
      environment: {
        AUDIO_BUCKET: props.audioBucketName,
        TABLE_NAME:   props.tableName,
        REGION:       'eu-central-1',
      },
    });

    // -----------------------------------------------------------------------
    // 3. Middleware Orchestrator
    // -----------------------------------------------------------------------
    this.middleware = new lambda.DockerImageFunction(this, 'MiddlewareFunction', {
      code: lambda.DockerImageCode.fromImageAsset(path.resolve(rootDir, 'services/middleware'), {
        file: 'docker/Dockerfile',
      }),
      memorySize: 256,
      timeout: cdk.Duration.seconds(60),
      environment: {
        API_KEY:                  process.env.API_KEY || '',
        AGENT_FUNCTION_NAME:      this.agent.functionName,
        TRANSCRIBE_FUNCTION_NAME: this.transcriber.functionName,
        TABLE_NAME:               props.tableName,
        REGION:                   'eu-central-1',
      },
    });

    // -----------------------------------------------------------------------
    // Permissions
    // -----------------------------------------------------------------------

    // Middleware → Agent + Transcriber
    this.agent.grantInvoke(this.middleware);
    this.transcriber.grantInvoke(this.middleware);

    // Agent: Bedrock
    this.agent.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));

    // Agent: DynamoDB — session table (read/write/scan) + notes + expenses (read/write/scan)
    this.agent.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Scan'],
      resources: [
        `arn:aws:dynamodb:eu-central-1:${this.account}:table/${props.tableName}`,
        `arn:aws:dynamodb:eu-central-1:${this.account}:table/${props.notesTableName}`,
        `arn:aws:dynamodb:eu-central-1:${this.account}:table/${props.expensesTableName}`,
      ],
    }));

    // Agent: Secrets Manager — read credentials secret
    this.agent.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [
        `arn:aws:secretsmanager:eu-central-1:${this.account}:secret:ServerlessAgent/credentials*`,
      ],
    }));

    // Transcriber: S3 + Transcribe + DynamoDB (to store job results)
    this.transcriber.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject', 's3:GetObject'],
      resources: [`arn:aws:s3:::${props.audioBucketName}/*`],
    }));
    this.transcriber.addToRolePolicy(new iam.PolicyStatement({
      actions: ['transcribe:StartTranscriptionJob', 'transcribe:GetTranscriptionJob'],
      resources: ['*'],
    }));
    this.transcriber.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:PutItem'],
      resources: [`arn:aws:dynamodb:eu-central-1:${this.account}:table/${props.tableName}`],
    }));

    // Middleware: DynamoDB — read/update transcription job status in session table
    this.middleware.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
      resources: [`arn:aws:dynamodb:eu-central-1:${this.account}:table/${props.tableName}`],
    }));
  }
}
