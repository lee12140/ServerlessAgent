/**
 * Skill: Read Calendar
 * Lists upcoming events from Google Calendar.
 */

export const readCalendarDefinition = {
  name: 'read_calendar_events',
  description: "Read the user's upcoming calendar events. Use this when the user asks what's on their schedule, what meetings they have, or what's coming up.",
  inputSchema: {
    json: {
      type: 'object',
      properties: {
        maxResults: {
          type: 'number',
          description: 'Maximum number of upcoming events to return (default: 10, max: 25)',
        },
        daysAhead: {
          type: 'number',
          description: 'How many days ahead to look (default: 7)',
        },
      },
      required: [],
    },
  },
};

import { google } from 'googleapis';

interface ReadCalendarInput {
  maxResults?: number;
  daysAhead?: number;
}

export async function readCalendarEvents(input: ReadCalendarInput): Promise<string> {
  const maxResults = Math.min(input.maxResults ?? 10, 25);
  const daysAhead = input.daysAhead ?? 7;

  const authEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const authKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  if (!authEmail || !authKey) {
    return 'Cannot read calendar: GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY must be set.';
  }

  try {
    const auth = new google.auth.JWT(authEmail, undefined, authKey, [
      'https://www.googleapis.com/auth/calendar.readonly',
    ]);
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

    if (!events || events.length === 0) {
      return `No events found in the next ${daysAhead} days.`;
    }

    const tz = 'Europe/Berlin';
    const formatted = events.map(event => {
      const start = event.start?.dateTime ?? event.start?.date ?? 'Unknown time';
      const dateStr = event.start?.dateTime
        ? new Date(start).toLocaleString('en-GB', {
            timeZone: tz,
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : start; // all-day event
      return `• ${dateStr} — ${event.summary ?? '(No title)'}`;
    });

    return `Upcoming events (next ${daysAhead} days):\n${formatted.join('\n')}`;
  } catch (error: any) {
    console.error('[ReadCalendar ERROR]:', error.message);
    return `Failed to read calendar: ${error.message}`;
  }
}
