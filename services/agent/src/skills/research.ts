/**
 * 🔍 Skill: Research (DuckDuckGo)
 * Enables the agent to search the web for real-time information.
 */
import { search, SafeSearchType } from 'duck-duck-scrape';

// Tool Definition for Bedrock
export const researchDefinition = {
    name: 'web_search',
    description: 'Searches the web for real-time information using DuckDuckGo. Use this for facts, news, or any data you don\'t have in your training set.',
    inputSchema: {
        json: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query to look up (e.g., "current stock price of NVDA", "latest news about renewable energy")'
                }
            },
            required: ['query'],
        },
    },
};

/**
 * Implementation of the web search logic
 */
interface WebSearchInput {
    query: string;
}

export async function webSearch(input: WebSearchInput): Promise<string> {
    const { query } = input;
    
    console.log(`[Research Skill] Searching for: ${query}`);

    const TIMEOUT_MS = 8000;

    try {
        const results = await Promise.race([
            search(query, { safeSearch: SafeSearchType.MODERATE }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Search timed out after 8 seconds')), TIMEOUT_MS)
            ),
        ]);

        if (!results.results || results.results.length === 0) {
            return `I couldn't find any relevant web results for "${query}".`;
        }

        // Extract the top 5 results for the LLM
        const topResults = results.results.slice(0, 5).map((res: { title: string; url: string; description: string }) => {
            return `Title: ${res.title}\nURL: ${res.url}\nSnippet: ${res.description}\n---`;
        }).join('\n');

        return `Web Search Results for "${query}":\n\n${topResults}\n\nNote: Please use these results to answer the user's request accurately.`;

    } catch (error: any) {
        console.error('[Research Skill ERROR]:', error);
        return `I encountered an error while searching the web: ${error.message || 'Unknown error'}. 
        You might need to try a different query or wait a moment.`;
    }
}
