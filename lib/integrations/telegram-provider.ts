import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { TelegramService } from "@/lib/telegram/telegram-service";
import { getRecentMessages } from "@/lib/repositories/unified-store-repository";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import { createAdminDb } from "@/lib/db";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";

export class TelegramProvider implements IntegrationProvider {
  id = "telegram";
  name = "Telegram";
  tokensExpire = false;
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
    throw new Error("Telegram bot tokens are static and cannot be refreshed via OAuth.");
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

  async executeTool(
    accessToken: string,
    toolName: string,
    args: Record<string, unknown>,
    ctx?: { userId?: string }
  ): Promise<unknown> {
    switch (toolName) {
      case "telegram_send_message":
        return await TelegramService.sendMessage(
          accessToken,
          args.chatId as string,
          args.text as string
        );
      case "telegram_fetch_messages":
        return await this.fetchMessages(accessToken, (args.limit as number) || 5, ctx?.userId);
      default:
        throw new Error(`Tool not supported: ${toolName}`);
    }
  }

  /** Prefer persisted webhook messages (they're the only durable Telegram
   *  ingress); fall back to the one-shot getUpdates queue (dev / no webhook). */
  private async fetchMessages(accessToken: string, limit: number, userId?: string): Promise<unknown[]> {
    if (userId) {
      try {
        const repo = new IntegrationsRepository(createAdminDb());
        const record = await repo.findByUserAndProvider(userId, "telegram");
        if (record?.id) {
          const stored = await getRecentMessages(userId, record.id, limit);
          if (stored.length > 0) return stored;
        }
      } catch (err) {
        console.warn("[Telegram] fetch from store failed, falling back to getUpdates", err);
      }
    }
    return TelegramService.getUpdates(accessToken, limit);
  }
}

IntegrationRegistry.register(new TelegramProvider());
