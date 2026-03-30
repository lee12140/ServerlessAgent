# Learning Module 04: The Front Door (API Gateway)

Every entry point needs a front door! For your AI agent, that's **Amazon API Gateway**. This is what will receive the messages from Telegram or Discord.

## Why API Gateway?
1. **Managed Service:** AWS handles the scaling and security.
2. **Easy Webhooks:** It gives you a public URL that you can give to Telegram/Discord.
3. **Trigger:** It tells your Lambda function to "Wake up!" when a message arrives.

## The Code
Create a new file named `infra/lib/api-stack.ts` and paste the following:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigateway_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  handler: lambda.IFunction;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Create the HTTP API
    const httpApi = new apigateway.HttpApi(this, 'OpenClawApi', {
      apiName: 'ServerlessOpenClaw',
      description: 'The entry point for OpenClaw messages',
    });

    // Connect the API to our (soon to be created) Lambda Handler
    httpApi.addRoutes({
      path: '/webhook',
      methods: [apigateway.HttpMethod.POST],
      integration: new apigateway_integrations.HttpLambdaIntegration('LambdaIntegration', props.handler),
    });

    // Output the URL so we can find it
    this.apiUrl = httpApi.apiEndpoint;
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
    });
  }
}
```

### What's happening here?
1. **`HttpApi`**: This creates a lightweight, high-performance API.
2. **`addRoutes`**: We create a specific path `/webhook` that only listens for `POST` requests (like when someone sends a message).
3. **`HttpLambdaIntegration`**: This is the "glue" that tells the API: "When someone hits this URL, run that Lambda function!"
4. **`ApiStackProps`**: Notice that we're passing in the `handler` (Lambda function). This shows how CDK stacks can talk to each other!

> [!TIP]
> Don't worry if your IDE shows an error about the file not existing or the Lambda function being missing—we haven't created the Lambda yet!
