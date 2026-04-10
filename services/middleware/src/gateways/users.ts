import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.REGION ?? 'eu-central-1';
const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) throw new Error('TABLE_NAME env var is not set');

export interface ResolvedUser {
  userId: string;
  active: boolean;
}

export interface UserGateway {
  resolve(apiKey: string): Promise<ResolvedUser | null>;
}

export class DynamoUserGateway implements UserGateway {
  private readonly client: DynamoDBDocumentClient;

  constructor() {
    this.client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  }

  // Looks up a user record by their API key.
  // Returns the user if found and active, null if the key does not exist.
  async resolve(apiKey: string): Promise<ResolvedUser | null> {
    const result = await this.client.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `user#${apiKey}` },
    }));

    if (!result.Item) return null;

    return {
      userId: result.Item['userId'] as string,
      active: result.Item['active'] as boolean,
    };
  }
}
