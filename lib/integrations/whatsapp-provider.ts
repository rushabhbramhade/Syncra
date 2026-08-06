import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { WhatsAppClientManager } from "@/lib/whatsapp/client";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";

// Tools backed purely by the local message cache. When the integration is not
// fully ready these return empty (never stale data); other tools throw instead.
const CACHE_BACKED_TOOLS = new Set([
  "whatsapp_fetch_messages",
  "whatsapp_read_chat",
  "whatsapp_search_chats",
  "whatsapp_summarize_chat",
  "whatsapp_fetch_group_messages",
]);

export class WhatsAppProvider implements IntegrationProvider {
  id = "whatsapp";
  name = "WhatsApp";
  tokensExpire = false;
  scopes = [];

  getAuthUrl(_origin: string, _state?: string): string {
    return "#";
  }

  async exchangeCode(_code: string, _origin: string): Promise<AuthTokens> {
    return { accessToken: "whatsapp_paired", expiresIn: 365 * 24 * 3600 };
  }

  async refreshAccess(_refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    return { accessToken: "whatsapp_paired", expiresIn: 365 * 24 * 3600 };
  }

  async getProfile(_accessToken: string): Promise<IntegrationProfile> {
    return { email: "whatsapp_linked_device" };
  }

  getTools(): MCPTool[] {
    return PLATFORM_MCP_TOOLS[this.id] || [];
  }

  async executeTool(accessToken: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const userId = accessToken.startsWith("whatsapp_token_")
      ? accessToken.replace("whatsapp_token_", "")
      : "";
    if (!userId) {
      throw new Error("Invalid WhatsApp session token.");
    }

    // Single source of truth: no tool (and no cache read) runs until the whole
    // integration is ready — auth + open socket + valid session + completed
    // initial sync + last sync succeeded. Cache is a performance layer only.
    const state = await WhatsAppClientManager.getConnectionState(userId);
    if (!state.ready) {
      if (CACHE_BACKED_TOOLS.has(toolName)) {
        // Return empty, not stale/fabricated data. Callers (briefing, dashboard,
        // search) fall back to their own empty state.
        return toolName === "whatsapp_summarize_chat"
          ? { summary: "WhatsApp integration is not fully synced.", messageCount: 0 }
          : [];
      }
      throw new Error("WhatsApp integration is not fully ready (auth, socket, or sync incomplete).");
    }

    const sock = await WhatsAppClientManager.getClient(userId);
    if (!sock) {
      throw new Error("WhatsApp connection is offline.");
    }

    switch (toolName) {
      case "whatsapp_fetch_messages": {
        const limit = (args.limit as number) || 10;
        const messages = WhatsAppClientManager.getMessages(userId);
        return messages.slice(0, limit);
      }
      case "whatsapp_read_chat": {
        const limit = (args.limit as number) || 15;
        const chatId = args.chatId as string;
        const messages = WhatsAppClientManager.getMessages(userId, chatId);
        return messages.slice(0, limit);
      }
      case "whatsapp_send_message": {
        const to = args.to as string;
        const toJid = to.includes("@") ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;
        const result = await sock.sendMessage(toJid, { text: args.message as string });
        return { success: true, messageId: result?.key?.id || "unknown" };
      }
      case "whatsapp_search_chats": {
        const query = (args.query as string).toLowerCase();
        const messages = WhatsAppClientManager.getMessages(userId);
        const filtered = messages.filter(m => 
          m.message.toLowerCase().includes(query) || 
          m.fromName.toLowerCase().includes(query)
        );
        return filtered;
      }
      case "whatsapp_summarize_chat": {
        const chatId = args.chatId as string;
        const messages = WhatsAppClientManager.getMessages(userId, chatId);
        if (messages.length === 0) {
          return { summary: "No message history available to summarize." };
        }
        let summary = `Chat with ${messages[0]?.fromName || "User"}: ${messages.length} messages available.`;
        try {
          const { generateJsonResponse } = await import("@/lib/ai-service");
          const aiResult = await generateJsonResponse<{ summary: string }>(
            "Summarize this WhatsApp conversation in 2-3 sentences. Focus on key topics, decisions, and action items.",
            { messages: messages.slice(0, 20).map(m => ({ from: m.fromName, text: m.message })) }
          );
          if (aiResult?.summary) summary = aiResult.summary;
        } catch {}
        return { summary, messageCount: messages.length, lastMessageTime: messages[0]?.timestamp };
      }
      case "whatsapp_get_contact": {
        const jid = args.jid as string;
        // ponytail: no contact store is wired, so this derives a placeholder from
        // the jid. Gated on readiness above so it never serves while unsynced.
        return {
          jid,
          name: jid.split("@")[0],
          status: "Hey there! I am using WhatsApp.",
          isBusiness: false,
        };
      }
      case "whatsapp_list_groups": {
        try {
          const groups = await sock.groupFetchAllParticipating();
          return Object.values(groups);
        } catch {
          throw new Error("Failed to fetch WhatsApp groups after multiple attempts");
        }
      }
      case "whatsapp_fetch_group_messages": {
        const limit = (args.limit as number) || 10;
        const groupId = args.groupId as string | undefined;
        const messages = WhatsAppClientManager.getMessages(userId, groupId);
        return messages.slice(0, limit);
      }
      case "whatsapp_send_group_message": {
        const groupId = args.groupId as string;
        const grpJid = groupId.includes("@g.us") ? groupId : `${groupId}@g.us`;
        const result = await sock.sendMessage(grpJid, { text: args.message });
        return { success: true, messageId: result?.key?.id || "unknown" };
      }
      default:
        throw new Error(`Tool not supported: ${toolName}`);
    }
  }
}

// Register the provider
IntegrationRegistry.register(new WhatsAppProvider());
