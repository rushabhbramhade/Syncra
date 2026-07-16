import { fetchWithRetry } from "@/lib/api-retry";

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  hangoutLink?: string;
  organizer?: { email: string; displayName?: string };
  recurringEventId?: string;
}

export class GoogleCalendarService {
  static async listCalendars(accessToken: string): Promise<{ id: string; summary: string; primary?: boolean }[]> {
    const res = await fetchWithRetry(`${CALENDAR_BASE}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    return (data.items || []).map((cal: any) => ({ id: cal.id, summary: cal.summary, primary: cal.primary }));
  }

  static async listEvents(
    accessToken: string,
    calendarId: string = "primary",
    timeMin?: string,
    timeMax?: string,
    maxResults: number = 20
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      maxResults: String(maxResults),
      singleEvents: "true",
      orderBy: "startTime",
    });
    if (timeMin) params.set("timeMin", timeMin);
    if (timeMax) params.set("timeMax", timeMax);

    const res = await fetchWithRetry(`${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    return (data.items || []).map((e: any) => ({
      id: e.id,
      summary: e.summary || "(No title)",
      description: e.description,
      start: e.start || {},
      end: e.end || {},
      location: e.location,
      attendees: e.attendees,
      hangoutLink: e.hangoutLink,
      organizer: e.organizer,
      recurringEventId: e.recurringEventId,
    }));
  }

  static async getEvent(accessToken: string, calendarId: string, eventId: string): Promise<CalendarEvent> {
    const res = await fetchWithRetry(`${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json();
  }
}
