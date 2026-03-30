import { runAgentTurn } from './agent.js';

interface AgentEvent {
  sessionId?: string;
  message: string;
}

/**
 * 🧠 Agent Handler
 * Specialist: Handles reasoning, tools, and DynamoDB memory.
 * Receives: { sessionId?: string, message: string }
 */
export const handler = async (event: AgentEvent) => {
    console.log('Agent received:', JSON.stringify(event));

    const { message, sessionId = 'default' } = event;

    if (!message) {
        throw new Error('No message provided to Agent');
    }

    const reply = await runAgentTurn(sessionId, message);

    return {
        message: reply,
        sessionId,
    };
};
