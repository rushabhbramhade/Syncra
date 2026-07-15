import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { TelegramService } from "@/lib/telegram/telegram-service";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";

export class TelegramProvider implements IntegrationProvider {
  id = "telegram";
  name = "Telegram";
  scopes: string[] = [];

  getAuthUrl(_origin: string, _state?: string): string {
    return "#";
  }

  async exchangeCode(code: string, _origin: string): Promise<AuthTokens> {
    const botInfo = await TelegramService.validateToken(code);
    return {
      accessToken: code,
      expiresIn: 86400 * 365,
    };
  }

  async refreshAccess(_refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    return { accessToken: "", expiresIn: 86400 * 365 };
  }

  async getProfile(accessToken: string): Promise<IntegrationProfile> {
    const botInfo = await TelegramService.validateToken(accessToken);
    return {
      email: `@${botInfo.username}`,
      providerAccountId: String(botInfo.id),
    };
  }

  getTools(): MCPTool[] {
    return PLATFORM_MCP_TOOLS[this.id] || [];
  }

  async executeTool(accessToken: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "telegram_send_message":
        return await TelegramService.sendMessage(
          accessToken,
          args.chatId as string,
          args.text as string
        );
      case "telegram_fetch_messages":
        return await TelegramService.getUpdates(accessToken, (args.limit as number) || 5);
      default:
        throw new Error(`Tool not supported: ${toolName}`);
    }
  }
}

IntegrationRegistry.register(new TelegramProvider());
