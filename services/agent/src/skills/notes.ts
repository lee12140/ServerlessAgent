/**
 * Skill: Notes
 * Store and retrieve personal notes in DynamoDB.
 * Uses the existing TABLE_NAME table with a "note#<key>" partition key.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' })
);

// --- Set Note ---

export const setNoteDefinition = {
  name: 'set_note',
  description: "Save a personal note under a short key/title. Use when the user wants to remember something, jot something down, or save information for later.",
  inputSchema: {
    json: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: "A short identifier for the note (e.g., 'grocery-list', 'project-ideas', 'passwords-hint'). Lowercase, no spaces.",
        },
        content: {
          type: 'string',
          description: "The content to save in the note",
        },
      },
      required: ['key', 'content'],
    },
  },
};

interface SetNoteInput {
  key: string;
  content: string;
}

export async function setNote(input: SetNoteInput): Promise<string> {
  const { key, content } = input;
  const tableName = process.env.TABLE_NAME;

  if (!tableName) return 'Cannot save note: TABLE_NAME environment variable is not set.';

  const noteKey = `note#${key.toLowerCase().replace(/\s+/g, '-')}`;

  try {
    await dynamo.send(new PutCommand({
      TableName: tableName,
      Item: {
        sessionId: noteKey,
        noteContent: content,
        updatedAt: Date.now(),
      },
    }));
    return `Note "${key}" saved successfully.`;
  } catch (error: any) {
    console.error('[SetNote ERROR]:', error.message);
    return `Failed to save note: ${error.message}`;
  }
}

// --- Get Note ---

export const getNoteDefinition = {
  name: 'get_note',
  description: "Retrieve a previously saved note by its key. Use when the user asks to recall, read, or retrieve a note they saved earlier.",
  inputSchema: {
    json: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: "The key of the note to retrieve. If unsure, pass 'list' to see all saved note keys.",
        },
      },
      required: ['key'],
    },
  },
};

interface GetNoteInput {
  key: string;
}

export async function getNote(input: GetNoteInput): Promise<string> {
  const { key } = input;
  const tableName = process.env.TABLE_NAME;

  if (!tableName) return 'Cannot read note: TABLE_NAME environment variable is not set.';

  // Special key: list all notes
  if (key === 'list') {
    try {
      const result = await dynamo.send(new ScanCommand({
        TableName: tableName,
        FilterExpression: 'begins_with(sessionId, :prefix)',
        ExpressionAttributeValues: { ':prefix': 'note#' },
        ProjectionExpression: 'sessionId, updatedAt',
      }));

      const items = result.Items ?? [];
      if (items.length === 0) return 'No notes saved yet.';

      const list = items.map(item => {
        const noteKey = (item['sessionId'] as string).replace('note#', '');
        const updated = item['updatedAt'] ? new Date(item['updatedAt'] as number).toLocaleDateString('en-GB') : 'unknown';
        return `• ${noteKey} (updated ${updated})`;
      }).join('\n');

      return `Saved notes:\n${list}`;
    } catch (error: any) {
      return `Failed to list notes: ${error.message}`;
    }
  }

  const noteKey = `note#${key.toLowerCase().replace(/\s+/g, '-')}`;

  try {
    const result = await dynamo.send(new GetCommand({
      TableName: tableName,
      Key: { sessionId: noteKey },
    }));

    if (!result.Item) return `No note found with key "${key}".`;

    return `Note "${key}":\n${result.Item['noteContent']}`;
  } catch (error: any) {
    console.error('[GetNote ERROR]:', error.message);
    return `Failed to retrieve note: ${error.message}`;
  }
}
