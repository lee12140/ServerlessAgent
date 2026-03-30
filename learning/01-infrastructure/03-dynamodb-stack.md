# Learning Module 03: Defining the Database (DynamoDB)

Your AI needs a place to remember things! For **Serverless Agent**, we use **Amazon DynamoDB**.

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
import { Construct } from 'constructs';

export class DbStack extends cdk.Stack {
  public readonly sessionTable: dynamodb.Table; // <-- Important! This declares the property

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define the DynamoDB Table for Session Memory
    this.sessionTable = new dynamodb.Table(this, 'SessionTable', {
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // No fixed cost!
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Deletes table if stack is deleted (careful in prod!)
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
4. **`removalPolicy`**: Since we're just learning, we setting it to `DESTROY` so that when we delete our CDK stack, the database is also cleaned up.

## Quick Fix for TypeScript Errors
If you see an error about `export` and `CommonJS`, it's because TypeScript is very strict by default. We've fixed this by setting `"type": "module"` in your `package.json`.
