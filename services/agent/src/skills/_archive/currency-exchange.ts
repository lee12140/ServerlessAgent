import type { Skill } from './types.js';

interface FrankfurterResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

async function currencyExchange(input: { from: string; to?: string; amount?: number }): Promise<string> {
  const { from, to, amount = 1 } = input;
  const base = from.toUpperCase();
  const target = to?.toUpperCase();

  const url = target
    ? `https://api.frankfurter.app/latest?from=${base}&to=${target}`
    : `https://api.frankfurter.app/latest?from=${base}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return `Exchange rate API error: ${res.status}. Check that currency codes are valid ISO 4217.`;

    const data = await res.json() as FrankfurterResponse;

    if (target) {
      const rate = data.rates[target];
      if (rate === undefined) return `No rate found for ${target}.`;
      const converted = parseFloat((amount * rate).toFixed(4));
      return amount === 1
        ? `1 ${base} = ${rate} ${target} (as of ${data.date})`
        : `${amount} ${base} = ${converted} ${target} (rate: ${rate}, as of ${data.date})`;
    }

    const lines = [`Exchange rates for ${base} (as of ${data.date}):`];
    for (const [currency, rate] of Object.entries(data.rates)) {
      lines.push(`  ${currency}: ${rate}`);
    }
    return lines.join('\n');
  } catch (error: any) {
    console.error('[CurrencyExchange ERROR]:', error.message);
    return `Failed to fetch exchange rates: ${error.message}`;
  }
}

export const currencyExchangeSkill: Skill = {
  definition: {
    name: 'currency_exchange',
    description: "Get real-time exchange rates or convert an amount between currencies.",
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          from: { type: 'string', description: "Source currency code (e.g., 'EUR', 'USD')" },
          to: { type: 'string', description: "Target currency code. Omit to get all major rates." },
          amount: { type: 'number', description: "Amount to convert (default: 1)" },
        },
        required: ['from'],
      },
    },
  },
  execute: (input) => currencyExchange(input as { from: string; to?: string; amount?: number }),
};
