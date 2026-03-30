# Learning Module 03: Defining the Database (DynamoDB)

Your AI needs a place to remember things! For **Serverless OpenClaw**, we use **Amazon DynamoDB**.

## Why DynamoDB?
1. **Serverless:** No servers to manage.
2. **Fast:** Millisecond response time.
3. **Pay-as-you-go:** Very cheap for small projects (often free!).

## Key Concepts
- **Table:** The main container for your data.
- **Partition Key:** A unique identifier for each item. We'll use `sessionId` to keep track of different conversations.

## The Code
Create a new file named `infra/lib/db-stack.ts` and paste the following code:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class DbStack extends cdk.Stack {
  public readonly sessionTable: dynamodb.Table;
  public readonly audioBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define the DynamoDB Table for Session Memory
    this.sessionTable = new dynamodb.Table(this, 'SessionTable', {
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // No fixed cost!
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Deletes table if stack is deleted (careful in prod!)
    });

    // S3 bucket for temporary audio uploads (used by the Transcriber)
    this.audioBucket = new s3.Bucket(this, 'AudioBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(1) }], // Auto-cleanup after 24h
    });

    // Output the Table Name so we can find it later
    new cdk.CfnOutput(this, 'TableName', {
      value: this.sessionTable.tableName,
    });
  }
}
```

### What's happening here?
1. **`import * as dynamodb`**: We bring in the DynamoDB tools from CDK.
2. **`partitionKey`**: We tell DynamoDB that every piece of data will have a `sessionId`.
3. **`billingMode`**: We set it to `PAY_PER_REQUEST` so we only pay when our AI reads or writes to the database.
4. **`removalPolicy`**: Since we're just learning, we set it to `DESTROY` so that when we delete our CDK stack, the database is also cleaned up.
5. **`audioBucket`**: An S3 bucket where the Transcriber service will temporarily store audio files before converting them to text. The `lifecycleRules` ensure files are deleted after 24 hours automatically.

## Quick Fix for TypeScript Errors
If you see an error about `export` and `CommonJS`, it's because TypeScript is very strict by default. We've fixed this by setting `"type": "module"` in your `package.json`.
