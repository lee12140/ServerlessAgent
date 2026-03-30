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
    const httpApi = new apigateway.HttpApi(this, 'ServerlessAgentApi', {
      apiName: 'ServerlessAgent',
      description: 'The entry point for Serverless Agent messages',
      corsPreflight: {
        allowMethods: [apigateway.CorsHttpMethod.POST, apigateway.CorsHttpMethod.OPTIONS],
        allowOrigins: process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : ['*'],
        allowHeaders: ['Content-Type', 'x-api-key'],
      },
    });

    // Rate limiting — 10 req/sec sustained, burst of 20
    const cfnStage = httpApi.defaultStage?.node.defaultChild as apigateway.CfnStage;
    cfnStage.defaultRouteSettings = {
      throttlingRateLimit: 10,
      throttlingBurstLimit: 20,
    };

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