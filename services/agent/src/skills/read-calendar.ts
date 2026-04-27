import type { Skill } from './types.js';
import { google } from 'googleapis';

async function readCalendarEvents(input: { maxResults?: number; daysAhead?: number }): Promise<string> {
  const maxResults = Math.min(input.maxResults ?? 10, 25);
  const daysAhead = input.daysAhead ?? 7;

  const authEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const authKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  if (!authEmail || !authKey) return 'Cannot read calendar: Google credentials are not configured.';

  try {
    const auth = new google.auth.JWT({ email: authEmail, key: authKey, scopes: ['https://www.googleapis.com/auth/calendar.readonly'] });
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;
    if (!events || events.length === 0) return `No events in the next ${daysAhead} days.`;

    const tz = 'Europe/Berlin';
    const lines = events.map(event => {
      const start = event.start?.dateTime ?? event.start?.date ?? '';
      const dateStr = event.start?.dateTime
        ? new Date(start).toLocaleString('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : start;
      return `• ${dateStr} — ${event.summary ?? '(No title)'}`;
    });

    return `Upcoming events (next ${daysAhead} days):\n${lines.join('\n')}`;
  } catch (error: any) {
    console.error('[ReadCalendar ERROR]:', error.message);
    return `Failed to read calendar: ${error.message}`;
  }
}

export const readCalendarSkill: Skill = {
  definition: {
    name: 'read_calendar_events',
    description: "Read the user's upcoming calendar events. Use when asked about schedule, meetings, or what's coming up.",
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          maxResults: { type: 'number', description: "Max events to return (default: 10, max: 25)" },
          daysAhead:  { type: 'number', description: "Days ahead to look (default: 7)" },
        },
        required: [],
      },
    },
  },
  execute: (input) => readCalendarEvents(input as { maxResults?: number; daysAhead?: number }),
};
