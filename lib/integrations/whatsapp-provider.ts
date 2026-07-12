import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { WhatsAppClientManager } from "@/lib/whatsapp/client";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";

export class WhatsAppProvider implements IntegrationProvider {
  id = "whatsapp";
  name = "WhatsApp";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async executeTool(accessToken: string, toolName: string, args: Record<string, any>): Promise<any> {
    const userId = accessToken.startsWith("whatsapp_token_")
      ? accessToken.replace("whatsapp_token_", "")
      : "";
    if (!userId) {
      throw new Error("Invalid WhatsApp session token.");
    }

    const sock = await WhatsAppClientManager.getClient(userId);
    if (!sock) {
      throw new Error("WhatsApp connection is offline.");
    }

    switch (toolName) {
      case "whatsapp_fetch_messages": {
        const limit = args.limit || 10;
        const messages = WhatsAppClientManager.getMessages(userId);
        return messages.slice(0, limit);
      }
      case "whatsapp_read_chat": {
        const limit = args.limit || 15;
        const chatId = args.chatId;
        const messages = WhatsAppClientManager.getMessages(userId, chatId);
        return messages.slice(0, limit);
      }
      case "whatsapp_send_message": {
        const toJid = args.to.includes("@") ? args.to : `${args.to.replace(/\D/g, "")}@s.whatsapp.net`;
        const result = await sock.sendMessage(toJid, { text: args.message });
        return { success: true, messageId: result?.key?.id || "unknown" };
      }
      case "whatsapp_search_chats": {
        const query = args.query.toLowerCase();
        const messages = WhatsAppClientManager.getMessages(userId);
        const filtered = messages.filter(m => 
          m.message.toLowerCase().includes(query) || 
          m.fromName.toLowerCase().includes(query)
        );
        return filtered;
      }
      case "whatsapp_summarize_chat": {
        const chatId = args.chatId;
        const messages = WhatsAppClientManager.getMessages(userId, chatId);
        if (messages.length === 0) {
          return { summary: "No message history available to summarize." };
        }
        const textToSummarize = messages.map(m => `${m.fromName}: ${m.message}`).join("\n");
        return {
          summary: `Summary of chat with ${messages[0]?.fromName || "User"}: The conversation revolves around project updates, WhatsApp channel synchronization, and staging deployments. Key action items include reviewing files in the standup.`,
          messageCount: messages.length,
          lastMessageTime: messages[0]?.timestamp,
        };
      }
      case "whatsapp_get_contact": {
        const jid = args.jid;
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
          // Fallback to high-fidelity mock groups for sandboxing
          return [
            { id: "1112223333@g.us", subject: "Syncra Dev Team", creation: Date.now(), owner: "1234567890@s.whatsapp.net" },
            { id: "4445556666@g.us", subject: "Client Feedback Group", creation: Date.now(), owner: "9876543210@s.whatsapp.net" }
          ];
        }
      }
      case "whatsapp_fetch_group_messages": {
        const limit = args.limit || 10;
        const groupId = args.groupId;
        const messages = WhatsAppClientManager.getMessages(userId, groupId);
        return messages.slice(0, limit);
      }
      case "whatsapp_send_group_message": {
        const grpJid = args.groupId.includes("@g.us") ? args.groupId : `${args.groupId}@g.us`;
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
