/**
 * Calendar Skill
 * Allows the agent to create Google Calendar events.
 */

// Tool Specification for Bedrock/Nova
export const createMeetingDefinition = {
  name: "create_calendar_meeting",
  description: "Schedule a new meeting or event on the user's calendar.",
  inputSchema: {
    json: {
      type: "object",
      properties: {
        title: { 
          type: "string", 
          description: "The name of the meeting (e.g., 'Project Sync')" 
        },
        startTime: { 
          type: "string", 
          description: "Start time in ISO 8601 format (e.g., '2026-03-27T10:00:00Z')" 
        },
        endTime: { 
          type: "string", 
          description: "End time in ISO 8601 format. If the user doesn't specify an end time, assume a duration of 1 hour from the start time." 
        },
        description: { 
          type: "string", 
          description: "Optional details about the meeting" 
        },
        timezone: { 
          type: "string", 
          description: "The IANA timezone string (e.g., 'Europe/Berlin'). Default to 'Europe/Berlin' if unknown.",
          default: "Europe/Berlin"
        }
      },
      required: ["title", "startTime", "endTime"]
    }
  }
};

import { google } from 'googleapis';

interface CreateMeetingInput {
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
    timezone?: string;
}

export async function createMeeting(input: CreateMeetingInput): Promise<string> {
    const { title, startTime, endTime, description } = input;
    const timezone = input.timezone || 'Europe/Berlin';
    
    // 1. Validation
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return "Error: The provided timestamps are invalid. Please use ISO 8601 format.";
    }

    if (end <= start) {
        return "Error: The meeting end time must be after the start time.";
    }

    console.log(`[Calendar Skill] Attempting to create meeting: ${title} (${timezone})`);
    
    // 2. Auth Check
    const authEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const authKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    if (!authEmail || !authKey) {
        return `I've prepared the meeting: "${title}" for ${startTime} to ${endTime} (${timezone}). 
        However, I need a Google Service Account (Email and Private Key) to actually save it! 
        Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in your Lambda environment.`;
    }

    try {
        // 3. Initialize Google Auth with broader scope
        const auth = new google.auth.JWT(
            authEmail,
            undefined,
            authKey,
            ['https://www.googleapis.com/auth/calendar']
        );

        const calendar = google.calendar({ version: 'v3', auth });

        // --- PRE-FLIGHT: Ensure the calendar is "added" to the service account's list ---
        // This often fixes 404s for shared calendars
        try {
            console.log(`[Calendar Skill] Ensuring subscription to: ${calendarId}`);
            await calendar.calendarList.insert({
                requestBody: { id: calendarId }
            });
        } catch (e: any) {
            // If it's already there (409), that's fine. 
            // In other cases, we log and continue to the insert.
            console.log(`[Calendar Skill Info] Subscription help: ${e.message}`);
        }

        // 4. Create the Event
        const event = {
            summary: title,
            description: description || 'User requested meeting',
            start: {
                dateTime: startTime,
                timeZone: timezone,
            },
            end: {
                dateTime: endTime,
                timeZone: timezone,
            },
        };

        console.log(`[Calendar Skill] Calling insert for calendar: ${calendarId}`);
        const response = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: event,
        });

        // Format a nice human-readable confirmation
        const dateObj = new Date(startTime);
        const dateString = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const timeString = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        return `Successfully scheduled your meeting: "${title}"! 📅
        
        Date: ${dateString}
        Time: ${timeString} (${timezone})
        Calendar: ${calendarId}
        Event Link: ${response.data.htmlLink}`;

    } catch (error: any) {
        // More detailed logging of the Google error response
        if (error.response && error.response.data) {
            console.error('[Calendar Skill ERROR BODY]:', JSON.stringify(error.response.data, null, 2));
        }
        console.error('[Calendar Skill ERROR]:', error.message);
        
        return `Failed to create meeting: ${error.message || 'Unknown error'}. 
        Please verify that the Calendar ID "${calendarId}" is correct and your Service Account has permission to edit it.`;
    }
}
