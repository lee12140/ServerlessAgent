import type { Skill } from './types.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' })
);

function tableOrError(): string | null {
  return process.env.NOTES_TABLE_NAME ?? null;
}

async function setNote(input: { key: string; content: string }): Promise<string> {
  const { key, content } = input;
  const table = tableOrError();
  if (!table) return 'Cannot save note: NOTES_TABLE_NAME is not set.';

  const noteKey = `note#${key.toLowerCase().replace(/\s+/g, '-')}`;
  try {
    await dynamo.send(new PutCommand({
      TableName: table,
      Item: { sessionId: noteKey, noteContent: content, updatedAt: Date.now() },
    }));
    return `Note "${key}" saved.`;
  } catch (error: any) {
    return `Failed to save note: ${error.message}`;
  }
}

async function getNote(input: { key: string }): Promise<string> {
  const { key } = input;
  const table = tableOrError();
  if (!table) return 'Cannot read note: NOTES_TABLE_NAME is not set.';

  if (key === 'list') {
    try {
      const result = await dynamo.send(new ScanCommand({
        TableName: table,
        FilterExpression: 'begins_with(sessionId, :p)',
        ExpressionAttributeValues: { ':p': 'note#' },
        ProjectionExpression: 'sessionId, updatedAt',
      }));
      const items = result.Items ?? [];
      if (items.length === 0) return 'No notes saved yet.';
      return 'Saved notes:\n' + items.map(i => {
        const k = (i['sessionId'] as string).replace('note#', '');
        const d = i['updatedAt'] ? new Date(i['updatedAt'] as number).toLocaleDateString('en-GB') : 'unknown';
        return `• ${k} (updated ${d})`;
      }).join('\n');
    } catch (error: any) {
      return `Failed to list notes: ${error.message}`;
    }
  }

  try {
    const result = await dynamo.send(new GetCommand({
      TableName: table,
      Key: { sessionId: `note#${key.toLowerCase().replace(/\s+/g, '-')}` },
    }));
    if (!result.Item) return `No note found with key "${key}".`;
    return `Note "${key}":\n${result.Item['noteContent']}`;
  } catch (error: any) {
    return `Failed to retrieve note: ${error.message}`;
  }
}

export const setNoteSkill: Skill = {
  definition: {
    name: 'set_note',
    description: "Save a personal note under a short key. Use when the user wants to remember something for later.",
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          key:     { type: 'string', description: "Short identifier (e.g., 'grocery-list'). Lowercase, no spaces." },
          content: { type: 'string', description: "The content to save" },
        },
        required: ['key', 'content'],
      },
    },
  },
  execute: (input) => setNote(input as { key: string; content: string }),
};

export const getNoteSkill: Skill = {
  definition: {
    name: 'get_note',
    description: "Retrieve a saved note by key. Pass key='list' to see all saved note keys.",
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          key: { type: 'string', description: "The note key to retrieve, or 'list' to see all." },
        },
        required: ['key'],
      },
    },
  },
  execute: (input) => getNote(input as { key: string }),
};
