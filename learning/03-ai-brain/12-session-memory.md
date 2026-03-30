# Module 12: The Memory Palace (Session Memory) 🏛️

Right now your AI forgets everything after each message. Module 12 gives it **memory** using the DynamoDB table you already deployed.

## 🧠 How it works
Each conversation gets a unique `sessionId`. The Lambda:
1. **Loads** past messages from DynamoDB for that session
2. **Sends** them all to the AI (so it has context)
3. **Saves** the new message + reply back to DynamoDB

## 📦 Step 1: Install the DynamoDB SDK
```powershell
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

## 🔑 Step 2: Grant DynamoDB permissions in `infra/lib/lambda-stack.ts`
Add this after the Marketplace permissions block:

```typescript
// 4. Grant DynamoDB session memory access
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
```

Actually—we do this differently. We'll pass the **table name** as an environment variable and grant access. Replace the full constructor body with:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';

interface LambdaStackProps extends cdk.StackProps {
  tableName: string;
}

export class LambdaStack extends cdk.Stack {
  public readonly handler: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const rootDir = path.resolve(__dirname, '../../');

    this.handler = new lambda.DockerImageFunction(this, 'OpenClawHandler', {
      code: lambda.DockerImageCode.fromImageAsset(rootDir, {
        file: 'docker/Dockerfile',
      }),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      architecture: lambda.Architecture.X86_64,
      environment: {
        TABLE_NAME: props.tableName,  // <-- pass the table name
        REGION: 'eu-central-1',
      },
    });

    // Bedrock permissions
    this.handler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));

    // Marketplace permissions for Anthropic models
    this.handler.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'aws-marketplace:ViewSubscriptions',
        'aws-marketplace:Subscribe',
        'aws-marketplace:Unsubscribe',
      ],
      resources: ['*'],
    }));

    // DynamoDB permissions
    this.handler.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
      ],
      resources: ['*'],
    }));
  }
}
```

## 🔗 Step 3: Wire it in `infra/bin/main.ts`
Update `main.ts` to pass the table name:

```typescript
import * as cdk from 'aws-cdk-lib';
import { DbStack } from '../lib/db-stack.js';
import { LambdaStack } from '../lib/lambda-stack.js';
import { ApiStack } from '../lib/api-stack.js';

const app = new cdk.App();
const dbStack = new DbStack(app, 'OpenClawDbStack');

const lambdaStack = new LambdaStack(app, 'OpenClawLambdaStack', {
  tableName: dbStack.sessionTable.tableName,   // pass the table name!
});
lambdaStack.addDependency(dbStack);

new ApiStack(app, 'OpenClawApiStack', {
  handler: lambdaStack.handler,
});
```

## 🧠 Step 4: The Smart Handler
Replace `src/handlers/index.ts` with this memory-aware version:

```typescript
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const bedrock = new BedrockRuntimeClient({ region: process.env.REGION || 'eu-central-1' });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' }));
const TABLE_NAME = process.env.TABLE_NAME!;

type Message = { role: 'user' | 'assistant'; content: { text: string }[] };

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const body = event.body ? JSON.parse(event.body) : {};
    const userMessage: string = body.message || 'Hello!';
    const sessionId: string = body.sessionId || 'default';

    // 1. Load conversation history from DynamoDB
    let history: Message[] = [];
    const existing = await dynamo.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { sessionId },
    }));
    if (existing.Item?.messages) {
        history = existing.Item.messages as Message[];
    }

    // 2. Add the new message
    history.push({ role: 'user', content: [{ text: userMessage }] });

    // 3. Call the AI with full history
    const response = await bedrock.send(new ConverseCommand({
        modelId: 'eu.amazon.nova-lite-v1:0',
        messages: history,
        inferenceConfig: { maxTokens: 1000, temperature: 0.7 },
    }));

    const aiText = response.output?.message?.content?.[0]?.text || 'I have no words.';

    // 4. Save the full history back to DynamoDB
    history.push({ role: 'assistant', content: [{ text: aiText }] });
    await dynamo.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { sessionId, messages: history, updatedAt: Date.now() },
    }));

    return {
        statusCode: 200,
        body: JSON.stringify({ message: aiText, sessionId }),
    };
};
```

## 🚀 Step 5: Deploy
```powershell
npx cdk deploy OpenClawLambdaStack
```

## 🧪 Step 6: Test The Memory!
```powershell
# First message
Invoke-RestMethod -Uri "https://2q2i0svz82.execute-api.eu-central-1.amazonaws.com/webhook" -Method Post -Body '{"message": "My name is Leo", "sessionId": "test-session-1"}' -ContentType "application/json"

# Ask follow-up - AI should remember your name!
Invoke-RestMethod -Uri "https://2q2i0svz82.execute-api.eu-central-1.amazonaws.com/webhook" -Method Post -Body '{"message": "What is my name?", "sessionId": "test-session-1"}' -ContentType "application/json"
```
