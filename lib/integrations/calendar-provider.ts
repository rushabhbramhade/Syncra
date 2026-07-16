import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { GoogleCalendarService } from "@/lib/google/calendar";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";

export class CalendarProvider implements IntegrationProvider {
  id = "calendar";
  name = "Google Calendar";
  scopes = ["https://www.googleapis.com/auth/calendar.readonly"];

  getAuthUrl(_origin: string, _state?: string): string {
    return "#";
  }

  async exchangeCode(_code: string, _origin: string): Promise<AuthTokens> {
    return { accessToken: "calendar_paired", expiresIn: 86400 * 365 };
  }

  async refreshAccess(_refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    return { accessToken: "calendar_paired", expiresIn: 86400 * 365 };
  }

  async getProfile(accessToken: string): Promise<IntegrationProfile> {
    const cals = await GoogleCalendarService.listCalendars(accessToken);
    const primary = cals.find(c => c.primary);
    return { email: primary?.id || "calendar@google.com", providerAccountId: primary?.id };
  }

  getTools(): MCPTool[] {
    return PLATFORM_MCP_TOOLS[this.id] || [];
  }

  async executeTool(accessToken: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "calendar_list_events":
        return GoogleCalendarService.listEvents(
          accessToken,
          args.calendarId as string || "primary",
          args.timeMin as string,
          args.timeMax as string,
          (args.limit as number) || 20
        );
      case "calendar_get_event":
        return GoogleCalendarService.getEvent(
          accessToken,
          args.calendarId as string || "primary",
          args.eventId as string
        );
      default:
        throw new Error(`Tool not supported: ${toolName}`);
    }
  }
}

IntegrationRegistry.register(new CalendarProvider());
