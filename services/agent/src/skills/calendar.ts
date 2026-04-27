import type { Skill } from './types.js';
import { google } from 'googleapis';

interface CreateMeetingInput {
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  timezone?: string;
}

async function createMeeting(input: CreateMeetingInput): Promise<string> {
  const { title, startTime, endTime, description } = input;
  const timezone = input.timezone || 'Europe/Berlin';

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Error: Invalid timestamps. Use ISO 8601 format.";
  if (end <= start) return "Error: End time must be after start time.";

  const authEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const authKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  if (!authEmail || !authKey) {
    return `Prepared meeting "${title}" for ${startTime}–${endTime} (${timezone}), but Google credentials are not configured.`;
  }

  try {
    const auth = new google.auth.JWT({ email: authEmail, key: authKey, scopes: ['https://www.googleapis.com/auth/calendar'] });
    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: title,
        ...(description ? { description } : {}),
        start: { dateTime: startTime, timeZone: timezone },
        end:   { dateTime: endTime,   timeZone: timezone },
      },
    });

    const dateStr = start.toLocaleDateString('en-GB', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = start.toLocaleTimeString('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' });

    return `Meeting scheduled: "${title}"\nDate: ${dateStr}\nTime: ${timeStr} (${timezone})\nLink: ${response.data.htmlLink}`;
  } catch (error: any) {
    if (error.response?.data) console.error('[Calendar ERROR BODY]:', JSON.stringify(error.response.data));
    return `Failed to create meeting: ${error.message}. Verify Calendar ID "${calendarId}" and service account permissions.`;
  }
}

export const createMeetingSkill: Skill = {
  definition: {
    name: 'create_calendar_meeting',
    description: "Schedule a new meeting or event on the user's Google Calendar.",
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          title:       { type: 'string', description: "Meeting name" },
          startTime:   { type: 'string', description: "Start time in ISO 8601 (e.g., '2026-04-01T10:00:00Z')" },
          endTime:     { type: 'string', description: "End time in ISO 8601. Default to 1 hour after start if not specified." },
          description: { type: 'string', description: "Optional details" },
          timezone:    { type: 'string', description: "IANA timezone (e.g., 'Europe/Berlin'). Default: 'Europe/Berlin'.", default: "Europe/Berlin" },
        },
        required: ['title', 'startTime', 'endTime'],
      },
    },
  },
  execute: (input) => createMeeting(input as CreateMeetingInput),
};
