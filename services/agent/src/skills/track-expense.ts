/**
 * Skill: Track Expense
 * Log and query personal expenses stored in DynamoDB.
 * Uses "expense#<timestamp>" as the partition key.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' })
);

// --- Log Expense ---

export const logExpenseDefinition = {
  name: 'log_expense',
  description: "Log a personal expense with amount, category, and description. Use when the user says they spent money or wants to track a purchase.",
  inputSchema: {
    json: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: "Amount spent (positive number)",
        },
        currency: {
          type: 'string',
          description: "Currency code (e.g., 'EUR', 'USD'). Defaults to 'EUR'.",
        },
        category: {
          type: 'string',
          description: "Category (e.g., 'Food', 'Transport', 'Entertainment', 'Shopping', 'Health')",
        },
        description: {
          type: 'string',
          description: "Short description of the expense",
        },
      },
      required: ['amount', 'category', 'description'],
    },
  },
};

interface LogExpenseInput {
  amount: number;
  currency?: string;
  category: string;
  description: string;
}

export async function logExpense(input: LogExpenseInput): Promise<string> {
  const { amount, currency = 'EUR', category, description } = input;
  const tableName = process.env.TABLE_NAME;

  if (!tableName) return 'Cannot log expense: TABLE_NAME environment variable is not set.';
  if (amount <= 0) return 'Error: Amount must be a positive number.';

  const timestamp = Date.now();
  const key = `expense#${timestamp}`;

  try {
    await dynamo.send(new PutCommand({
      TableName: tableName,
      Item: {
        sessionId: key,
        amount,
        currency: currency.toUpperCase(),
        category,
        description,
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        createdAt: timestamp,
      },
    }));

    return `Expense logged: ${amount} ${currency.toUpperCase()} — ${description} (${category})`;
  } catch (error: any) {
    console.error('[LogExpense ERROR]:', error.message);
    return `Failed to log expense: ${error.message}`;
  }
}

// --- Get Expenses ---

export const getExpensesDefinition = {
  name: 'get_expenses',
  description: "Retrieve logged expenses with an optional summary by category. Use when the user asks how much they've spent, wants a spending overview, or asks to see their expenses.",
  inputSchema: {
    json: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: "Maximum number of recent expenses to return (default: 20)",
        },
      },
      required: [],
    },
  },
};

interface GetExpensesInput {
  limit?: number;
}

interface ExpenseItem {
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string;
  createdAt: number;
}

export async function getExpenses(input: GetExpensesInput): Promise<string> {
  const limit = input.limit ?? 20;
  const tableName = process.env.TABLE_NAME;

  if (!tableName) return 'Cannot read expenses: TABLE_NAME environment variable is not set.';

  try {
    const result = await dynamo.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'begins_with(sessionId, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'expense#' },
    }));

    const items = (result.Items ?? []) as unknown as (ExpenseItem & { sessionId: string })[];

    if (items.length === 0) return 'No expenses logged yet.';

    // Sort by date descending
    items.sort((a, b) => b.createdAt - a.createdAt);
    const recent = items.slice(0, limit);

    // Category totals (EUR only for simplicity)
    const totals: Record<string, number> = {};
    for (const item of items) {
      if (item.currency === 'EUR') {
        totals[item.category] = (totals[item.category] ?? 0) + item.amount;
      }
    }

    const lines = [`Last ${recent.length} expense(s):`];
    for (const item of recent) {
      lines.push(`• ${item.date} | ${item.amount} ${item.currency} | ${item.category} — ${item.description}`);
    }

    if (Object.keys(totals).length > 0) {
      lines.push('\nTotal by category (EUR):');
      for (const [cat, total] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
        lines.push(`  ${cat}: ${total.toFixed(2)} EUR`);
      }
    }

    return lines.join('\n');
  } catch (error: any) {
    console.error('[GetExpenses ERROR]:', error.message);
    return `Failed to retrieve expenses: ${error.message}`;
  }
}
