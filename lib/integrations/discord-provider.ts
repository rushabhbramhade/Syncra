import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { DiscordService } from "@/lib/discord/discord-service";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";

export class DiscordProvider implements IntegrationProvider {
  id = "discord";
  name = "Discord";
  scopes: string[] = [];

  getAuthUrl(_origin: string, _state?: string): string {
    return this.getInviteUrl();
  }

  async exchangeCode(_code: string, _origin: string): Promise<AuthTokens> {
    const token = this.getBotToken();
    const botInfo = await DiscordService.validateToken(token);
    return {
      accessToken: token,
      expiresIn: 86400 * 365,
    };
  }

  async refreshAccess(_refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    return { accessToken: "", expiresIn: 86400 * 365 };
  }

  async getProfile(_accessToken: string): Promise<IntegrationProfile> {
    const token = this.getBotToken();
    const botInfo = await DiscordService.validateToken(token);
    return {
      email: `@${botInfo.username}`,
      providerAccountId: botInfo.id,
    };
  }

  getTools(): MCPTool[] {
    return PLATFORM_MCP_TOOLS[this.id] || [];
  }

  async executeTool(accessToken: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "discord_send_message":
        return await DiscordService.sendMessage(
          accessToken,
          args.channelId as string,
          args.content as string
        );
      case "discord_fetch_messages":
        return await DiscordService.fetchMessages(
          accessToken,
          args.channelId as string,
          (args.limit as number) || 5
        );
      case "discord_fetch_recent_messages":
        return await DiscordService.fetchRecentMessages(
          accessToken,
          (args.limit as number) || 3
        );
      case "discord_list_guilds":
        return await DiscordService.getGuilds(accessToken);
      case "discord_list_channels":
        return await DiscordService.listChannels(
          accessToken,
          args.guildId as string
        );
      default:
        throw new Error(`Tool not supported: ${toolName}`);
    }
  }

  getBotToken(): string {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("DISCORD_BOT_TOKEN environment variable is not set.");
    return token;
  }

  getInviteUrl(): string {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) throw new Error("DISCORD_CLIENT_ID environment variable is not set.");
    const permissions = "35840";
    return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot`;
  }
}

IntegrationRegistry.register(new DiscordProvider());
