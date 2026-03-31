import type { Skill } from './types.js';

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function fetchUrlContent(input: { url: string }): Promise<string> {
  const { url } = input;
  if (!url.startsWith('https://')) return 'Error: Only HTTPS URLs are supported.';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ServerlessAgent/1.0)' },
    });
    clearTimeout(timer);

    if (!res.ok) return `Failed to fetch URL: HTTP ${res.status} ${res.statusText}`;

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/')) return `Cannot read this URL: content type is "${contentType}".`;

    const text = stripHtml(await res.text());
    const truncated = text.length > 4000 ? text.slice(0, 4000) + '... [truncated]' : text;
    return `Content from ${url}:\n\n${truncated}`;
  } catch (error: any) {
    console.error('[FetchURL ERROR]:', error.message);
    return `Failed to fetch URL: ${error.message}`;
  }
}

export const fetchUrlSkill: Skill = {
  definition: {
    name: 'fetch_url_content',
    description: "Fetch and read the text content of a webpage. Use when the user shares a URL and asks you to read or summarize it.",
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          url: { type: 'string', description: "Full HTTPS URL to fetch" },
        },
        required: ['url'],
      },
    },
  },
  execute: (input) => fetchUrlContent(input as { url: string }),
};
