import type { Skill } from './types.js';
import { search, SafeSearchType } from 'duck-duck-scrape';

async function webSearch(input: { query: string }): Promise<string> {
  const { query } = input;
  console.log(`[Research] Searching: ${query}`);

  try {
    const results = await Promise.race([
      search(query, { safeSearch: SafeSearchType.MODERATE }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Search timed out after 8 seconds')), 8000)
      ),
    ]);

    if (!results.results || results.results.length === 0) {
      return `No relevant results found for "${query}".`;
    }

    const top = results.results.slice(0, 5).map((r: { title: string; url: string; description: string }) =>
      `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.description}\n---`
    ).join('\n');

    return `Web Search Results for "${query}":\n\n${top}\n\nUse these results to answer the user's request accurately.`;
  } catch (error: any) {
    console.error('[Research ERROR]:', error);
    return `Search error: ${error.message || 'Unknown error'}`;
  }
}

export const webSearchSkill: Skill = {
  definition: {
    name: 'web_search',
    description: "Search the web for real-time information using DuckDuckGo. Use for facts, news, or data not in your training set.",
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: "The search query (e.g., 'current NVDA stock price', 'latest AI news')",
          },
        },
        required: ['query'],
      },
    },
  },
  execute: (input) => webSearch(input as { query: string }),
};
