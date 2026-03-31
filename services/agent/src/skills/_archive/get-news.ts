import type { Skill } from './types.js';
import { searchNews, SafeSearchType } from 'duck-duck-scrape';

async function getNews(input: { topic: string }): Promise<string> {
  const { topic } = input;
  console.log(`[News] Searching: ${topic}`);

  try {
    const results = await Promise.race([
      searchNews(topic, { safeSearch: SafeSearchType.MODERATE }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('News search timed out')), 8000)
      ),
    ]);

    if (!results.results || results.results.length === 0) return `No news found for "${topic}".`;

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

export const getNewsSkill: Skill = {
  definition: {
    name: 'get_news',
    description: "Fetch the latest news headlines for a topic or keyword.",
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: "News topic or keywords (e.g., 'AI regulation', 'DAX')" },
        },
        required: ['topic'],
      },
    },
  },
  execute: (input) => getNews(input as { topic: string }),
};
