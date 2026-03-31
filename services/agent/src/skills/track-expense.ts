import type { Skill } from './types.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' })
);

function tableOrError(): string | null {
  return process.env.EXPENSES_TABLE_NAME ?? null;
}

async function logExpense(input: { amount: number; currency?: string; category: string; description: string }): Promise<string> {
  const { amount, currency = 'EUR', category, description } = input;
  const table = tableOrError();
  if (!table) return 'Cannot log expense: EXPENSES_TABLE_NAME is not set.';
  if (amount <= 0) return 'Error: Amount must be positive.';

  const timestamp = Date.now();
  try {
    await dynamo.send(new PutCommand({
      TableName: table,
      Item: {
        sessionId: `expense#${timestamp}`,
        amount, currency: currency.toUpperCase(), category, description,
        date: new Date().toISOString().split('T')[0],
        createdAt: timestamp,
      },
    }));
    return `Logged: ${amount} ${currency.toUpperCase()} — ${description} (${category})`;
  } catch (error: any) {
    return `Failed to log expense: ${error.message}`;
  }
}

interface ExpenseItem {
  amount: number; currency: string; category: string;
  description: string; date: string; createdAt: number;
}

async function getExpenses(input: { limit?: number }): Promise<string> {
  const limit = input.limit ?? 20;
  const table = tableOrError();
  if (!table) return 'Cannot read expenses: EXPENSES_TABLE_NAME is not set.';

  try {
    const result = await dynamo.send(new ScanCommand({
      TableName: table,
      FilterExpression: 'begins_with(sessionId, :p)',
      ExpressionAttributeValues: { ':p': 'expense#' },
    }));

    const items = (result.Items ?? []) as unknown as (ExpenseItem & { sessionId: string })[];
    if (items.length === 0) return 'No expenses logged yet.';

    items.sort((a, b) => b.createdAt - a.createdAt);
    const recent = items.slice(0, limit);

    const totals: Record<string, number> = {};
    for (const item of items) {
      if (item.currency === 'EUR') totals[item.category] = (totals[item.category] ?? 0) + item.amount;
    }

    const lines = [`Last ${recent.length} expense(s):`];
    recent.forEach(i => lines.push(`• ${i.date} | ${i.amount} ${i.currency} | ${i.category} — ${i.description}`));

    if (Object.keys(totals).length > 0) {
      lines.push('\nTotal by category (EUR):');
      Object.entries(totals).sort((a, b) => b[1] - a[1]).forEach(([cat, total]) => {
        lines.push(`  ${cat}: ${total.toFixed(2)} EUR`);
      });
    }
    return lines.join('\n');
  } catch (error: any) {
    return `Failed to retrieve expenses: ${error.message}`;
  }
}

export const logExpenseSkill: Skill = {
  definition: {
    name: 'log_expense',
    description: "Log a personal expense with amount, category, and description.",
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          amount:      { type: 'number', description: "Amount spent (positive)" },
          currency:    { type: 'string', description: "Currency code (default: 'EUR')" },
          category:    { type: 'string', description: "Category (e.g., 'Food', 'Transport')" },
          description: { type: 'string', description: "Short description" },
        },
        required: ['amount', 'category', 'description'],
      },
    },
  },
  execute: (input) => logExpense(input as { amount: number; currency?: string; category: string; description: string }),
};

export const getExpensesSkill: Skill = {
  definition: {
    name: 'get_expenses',
    description: "Retrieve logged expenses with category totals.",
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: "Max recent expenses to return (default: 20)" },
        },
        required: [],
      },
    },
  },
  execute: (input) => getExpenses(input as { limit?: number }),
};
