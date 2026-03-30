import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class DbStack extends cdk.Stack {
    public readonly sessionTable: dynamodb.Table;
    public readonly audioBucket: s3.Bucket;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.sessionTable = new dynamodb.Table(this, 'SessionTable', {
            partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        this.audioBucket = new s3.Bucket(this, 'AudioBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            lifecycleRules: [{ expiration: cdk.Duration.days(1) }]
        });

        new cdk.CfnOutput(this, 'TableName', {
            value: this.sessionTable.tableName,
        });
    }
}
