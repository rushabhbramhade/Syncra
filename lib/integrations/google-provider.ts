import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { GmailService } from "@/lib/google/gmail";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";

export class GoogleProvider implements IntegrationProvider {
  id = "gmail";
  name = "Gmail";
  scopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify"
  ];

  getAuthUrl(origin: string, state?: string): string {
    // GmailService.getAuthUrl handles building the Google OAuth login link
    return GmailService.getAuthUrl(origin, state);
  }

  async exchangeCode(code: string, origin: string): Promise<AuthTokens> {
    const tokens = await GmailService.exchangeCode(code, origin);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in
    };
  }

  async refreshAccess(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const refreshData = await GmailService.refreshAccessToken(refreshToken);
    return {
      accessToken: refreshData.access_token,
      expiresIn: refreshData.expires_in
    };
  }

  async getProfile(accessToken: string): Promise<IntegrationProfile> {
    const profile = await GmailService.getProfile(accessToken);
    return {
      email: profile.emailAddress,
      providerAccountId: profile.emailAddress
    };
  }

  async revokeAccess(token: string): Promise<void> {
    await GmailService.revokeToken(token);
  }

  getTools(): MCPTool[] {
    return PLATFORM_MCP_TOOLS[this.id] || [];
  }

  async executeTool(accessToken: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "gmail_search_emails":
        return await GmailService.searchEmails(accessToken, args.query as string, args.limit as number);
      case "gmail_get_email":
        return await GmailService.getEmail(accessToken, args.messageId as string);
      case "gmail_send_email":
        return await GmailService.sendEmail(accessToken, args.to as string, args.subject as string, args.body as string, args.threadId as string | undefined);
      case "gmail_list_labels":
        return await GmailService.getLabels(accessToken);
      case "gmail_archive_message":
        return await GmailService.modifyLabels(accessToken, args.messageId as string, [] as string[], ["INBOX"] as string[]);
      case "gmail_delete_message":
        await GmailService.deleteMessage(accessToken, args.messageId as string);
        return { success: true, message: `Message ${args.messageId} moved to trash.` };
      case "gmail_mark_read":
        return await GmailService.modifyLabels(accessToken, args.messageId as string, [] as string[], ["UNREAD"] as string[]);
      case "gmail_mark_unread":
        return await GmailService.modifyLabels(accessToken, args.messageId as string, ["UNREAD"] as string[], [] as string[]);
      default:
        throw new Error(`Tool not supported: ${toolName}`);
    }
  }
}

// Auto-register the provider in the registry
IntegrationRegistry.register(new GoogleProvider());
