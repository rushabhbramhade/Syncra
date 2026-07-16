import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { OutlookService } from "@/lib/outlook/outlook-service";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";

export class OutlookProvider implements IntegrationProvider {
  id = "outlook";
  name = "Outlook";
  scopes = ["Mail.Read", "Mail.Send", "User.Read"];

  private get config() {
    return { clientId: process.env.OUTLOOK_CLIENT_ID!, clientSecret: process.env.OUTLOOK_CLIENT_SECRET! };
  }

  getAuthUrl(origin: string, state?: string): string {
    const redirectUri = `${origin}/api/outlook-callback`;
    return `${OutlookService.getAuthUrl(this.config.clientId, redirectUri, state || "")}`;
  }

  async exchangeCode(code: string, origin: string): Promise<AuthTokens> {
    const redirectUri = `${origin}/api/outlook-callback`;
    const tokens = await OutlookService.exchangeCode(code, this.config.clientId, this.config.clientSecret, redirectUri);
    return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresIn: tokens.expires_in };
  }

  async refreshAccess(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const tokens = await OutlookService.refreshAccessToken(refreshToken, this.config.clientId, this.config.clientSecret);
    return { accessToken: tokens.access_token, expiresIn: tokens.expires_in };
  }

  async getProfile(accessToken: string): Promise<IntegrationProfile> {
    const profile = await OutlookService.getProfile(accessToken);
    return { email: profile.mail || profile.userPrincipalName, providerAccountId: profile.id };
  }

  getTools(): MCPTool[] { return PLATFORM_MCP_TOOLS[this.id] || []; }

  async executeTool(accessToken: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "outlook_search_emails":
        return OutlookService.searchEmails(accessToken, args.query as string, args.limit as number);
      case "outlook_send_email":
        return OutlookService.sendEmail(accessToken, args.to as string, args.subject as string, args.body as string);
      default:
        throw new Error(`Tool not supported: ${toolName}`);
    }
  }
}

IntegrationRegistry.register(new OutlookProvider());
