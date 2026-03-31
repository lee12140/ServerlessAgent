/**
 * Skill: Get Current Time
 * A simple example skill — returns the current date and time.
 */

// This is the "declaration" — what you tell the LLM about this tool
export const getTimeDefinition = {
    name: 'get_current_time',
    description: 'Returns the current date and time. Use this when the user asks what time it is.',
    inputSchema: {
        json: {
            type: 'object',
            properties: {},  // No inputs needed
            required: [],
        },
    },
};

// This is the actual implementation
export function getTime(): string {
    const now = new Date();
    const tz = 'Europe/Berlin';
    return `The current time is ${now.toLocaleTimeString('en-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit' })} on ${now.toLocaleDateString('en-DE', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
}