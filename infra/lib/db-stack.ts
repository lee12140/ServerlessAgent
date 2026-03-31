import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DbStack extends cdk.Stack {
    public readonly sessionTable: dynamodb.Table;
    public readonly notesTable: dynamodb.Table;
    public readonly expensesTable: dynamodb.Table;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.sessionTable = new dynamodb.Table(this, 'SessionTable', {
            partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: 'ttl',
        });

        this.notesTable = new dynamodb.Table(this, 'NotesTable', {
            partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        this.expensesTable = new dynamodb.Table(this, 'ExpensesTable', {
            partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        new cdk.CfnOutput(this, 'TableName',         { value: this.sessionTable.tableName });
        new cdk.CfnOutput(this, 'NotesTableName',    { value: this.notesTable.tableName });
        new cdk.CfnOutput(this, 'ExpensesTableName', { value: this.expensesTable.tableName });
    }
}
