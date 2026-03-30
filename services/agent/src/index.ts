import { runAgentTurn } from './agent.js';

/**
 * 🧠 Agent Handler
 * Specialist: Handles reasoning, tools, and DynamoDB memory.
 * Receives: { sessionId: string, message: string }
 */
export const handler = async (event: any) => {
    console.log('Agent received:', JSON.stringify(event));
    
    const { sessionId, message } = event;
    
    if (!message) {
        throw new Error('No message provided to Agent');
    }

    const reply = await runAgentTurn(sessionId || 'default', message);

    return {
        message: reply,
        sessionId
    };
};
