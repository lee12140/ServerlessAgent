/**
 * Skill: Get News
 * Fetches top news headlines for a topic using DuckDuckGo news search.
 */
import { searchNews, SafeSearchType } from 'duck-duck-scrape';

export const getNewsDefinition = {
  name: 'get_news',
  description: "Fetch the latest news headlines for a topic or keyword. Use when the user asks for recent news, headlines, or current events.",
  inputSchema: {
    json: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: "The news topic or keywords to search for (e.g., 'AI regulation', 'DAX stock market', 'climate change')",
        },
      },
      required: ['topic'],
    },
  },
};

interface NewsInput {
  topic: string;
}

export async function getNews(input: NewsInput): Promise<string> {
  const { topic } = input;

  console.log(`[News Skill] Searching news for: ${topic}`);

  try {
    const results = await Promise.race([
      searchNews(topic, { safeSearch: SafeSearchType.MODERATE }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('News search timed out after 8 seconds')), 8000)
      ),
    ]);

    if (!results.results || results.results.length === 0) {
      return `No news found for "${topic}".`;
    }

    const top = results.results.slice(0, 5).map(item => {
      const date = item.date ? new Date(item.date).toLocaleDateString('en-GB') : 'Unknown date';
      return `• [${date}] ${item.title}\n  ${item.url}\n  ${item.excerpt ?? ''}`;
    }).join('\n\n');

    return `Latest news for "${topic}":\n\n${top}`;
  } catch (error: any) {
    console.error('[News ERROR]:', error.message);
    return `Failed to fetch news: ${error.message}`;
  }
}
