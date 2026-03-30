import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { DbStack } from '../lib/db-stack.js';
import { LambdaStack } from '../lib/lambda-stack.js';
import { ApiStack } from '../lib/api-stack.js';

const app = new cdk.App();

// 1. Create the Database
const dbStack = new DbStack(app, 'AgentDbStack');

// 2. Create the Lambda (Brain) - pass the table name for session memory
const lambdaStack = new LambdaStack(app, 'AgentLambdaStack', {
    tableName: dbStack.sessionTable.tableName,
    audioBucketName: dbStack.audioBucket.bucketName,
});
lambdaStack.addDependency(dbStack);

// 3. Create the API and connect it to the Middleware
new ApiStack(app, 'AgentApiStack', {
    handler: lambdaStack.middleware,
});

// Synthesize the app
app.synth();