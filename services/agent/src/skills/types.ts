/**
 * Skill Interface
 *
 * Every skill is a self-contained object with two parts:
 *   - definition: what the LLM sees (name, description, input schema)
 *   - execute:    the actual implementation called when the LLM picks this tool
 *
 * To add a new skill:
 *   1. Create services/agent/src/skills/my-skill.ts and export a Skill object
 *   2. Add it to the array in skills/index.ts
 *   That's it — agent.ts picks it up automatically.
 */

import type { ToolDefinition } from '../adapters/bedrock.js';

export type { ToolDefinition };

export interface Skill {
  definition: ToolDefinition;
  execute(input: unknown): string | Promise<string>;
}
