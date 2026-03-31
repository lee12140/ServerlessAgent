/**
 * Skill: Calculate
 * Evaluates a mathematical expression safely.
 * Avoids LLM arithmetic errors by delegating to a real evaluator.
 */

export const calculateDefinition = {
  name: 'calculate',
  description: "Evaluate a mathematical expression and return the exact result. Use this for any arithmetic, percentages, or numeric calculations instead of guessing.",
  inputSchema: {
    json: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: "A math expression to evaluate (e.g., '15 * 1.19', '(100 / 7) * 3', 'Math.sqrt(144)')",
        },
      },
      required: ['expression'],
    },
  },
};

interface CalculateInput {
  expression: string;
}

// Allow digits, operators, parens, decimals, whitespace, and safe Math identifiers.
const SAFE_PATTERN = /^[\d\s\+\-\*\/\(\)\.\%,]+$|^([\d\s\+\-\*\/\(\)\.\%,]|Math\.(abs|ceil|floor|round|sqrt|pow|log|log2|log10|min|max|PI|E|sin|cos|tan)|\s)+$/;

export function calculate(input: CalculateInput): string {
  const { expression } = input;

  if (!SAFE_PATTERN.test(expression)) {
    return `Error: Expression contains unsupported characters. Only arithmetic operators and Math built-ins are allowed.`;
  }

  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; const Math = globalThis.Math; return (${expression})`)();

    if (typeof result !== 'number') {
      return `Error: Expression did not produce a numeric result.`;
    }
    if (!isFinite(result)) {
      return `Result: ${result} (division by zero or overflow)`;
    }

    // Round to 10 decimal places to avoid floating-point noise
    const rounded = parseFloat(result.toFixed(10));
    return `${expression} = ${rounded}`;
  } catch (error: any) {
    return `Error evaluating expression: ${error.message}`;
  }
}
