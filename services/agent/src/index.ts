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

    const { message, sessionId } = event;
    const resolvedSessionId = sessionId || crypto.randomUUID();

    if (!message) {
        throw new Error('No message provided to Agent');
    }

    // Log metadata only — never log message content (privacy)
    console.log(`Agent invoked: sessionId=${resolvedSessionId}, messageLength=${message.length}`);

    const reply = await runAgentTurn(resolvedSessionId, message);

    return {
        message: reply,
        sessionId: resolvedSessionId,
    };
};
